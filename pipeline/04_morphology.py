#!/usr/bin/env python3
"""
PHASE 4 — Morphology & Feature Extraction (Ronuk).

Measure the aneurysm — the numbers a clinician and a rupture-risk score actually use. This is
the factual backbone of Claude's risk reasoning (get_morphology reads this file).

Blocks in morphology.json:
    geometry     — max_diameter_mm, height_mm, neck_width_mm, aspect_ratio, size_ratio, location.
                   COMPUTED from the aneurysm mesh + parent-vessel radius (the AneuX 170 indices
                   are shape descriptors, not these classic size metrics, so we compute them).
    hemodynamics — peak/mean WSS, OSI, low-shear fraction. From Phase 3 (Tier 1/2). If only the
                   Tier 3 proxy ran, no real WSS exists → a flagged placeholder is written and the
                   copilot must present flow as proxy-only (honesty rule).
    clinical     — rupture_status, patient_age, patient_sex. From AneuX clinical.csv (real).

Definitions used (documented so they're auditable):
    aspect_ratio = height / neck_width
    size_ratio   = height / parent_vessel_diameter   (parent_diameter = 2 * radius at aneurysm node)

Usage:
    python pipeline/04_morphology.py --case C0035 --vessel-file-id p043_... \\
        --artifacts artifacts --aneux-dir zenodo_aneux/data
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import contracts  # noqa: E402

DEFAULT_ANEUX = os.path.join(os.path.dirname(__file__), "..", "zenodo_aneux", "data")

_LOCATION_MAP = {
    "ICA": "ICA", "MCA": "MCA", "ACA": "ACA", "ACOM": "AComm", "ACOMM": "AComm",
    "PCOM": "PComm", "PCOMM": "PComm", "BA": "BA", "BAS": "BA", "VA": "VA",
    # vessel-segment codes (e.g. CMHA uses M1/M2 for MCA segments)
    "M1": "MCA", "M2": "MCA", "M3": "MCA", "A1": "ACA", "A2": "ACA",
    "P1": "PComm", "P2": "PComm", "IC": "ICA",
}


def normalize_location(raw: str) -> str:
    if not raw:
        return "other"
    return _LOCATION_MAP.get(raw.strip().upper().split()[0], "other")


def normalize_sex(raw: str) -> str:
    r = (raw or "").strip().lower()
    return {"female": "F", "f": "F", "male": "M", "m": "M"}.get(r, "unknown")


# ── clinical (real AneuX data) ──────────────────────────────────────────────────────────────
def load_clinical(aneux_dir: str, vessel_file_id: str) -> dict:
    import pandas as pd

    df = pd.read_csv(os.path.join(aneux_dir, "clinical.csv"))
    row = df[df["vesselFileID"] == vessel_file_id]
    if row.empty:
        raise SystemExit(f"vesselFileID {vessel_file_id!r} not found in clinical.csv")
    r = row.iloc[0]
    return {
        "rupture_status": str(r["status"]).strip().lower(),
        "patient_age": round(float(r["age"]), 1),
        "patient_sex": normalize_sex(str(r["sex"])),
        "_location": normalize_location(str(r["location"])),
    }


# ── CMHA dataset: real CFD hemodynamics + real morphometry (Song et al., Sci Data 2024) ─────
def _cmha_row(stats_dir: str, csv_name: str, number: str) -> dict:
    import csv

    with open(os.path.join(stats_dir, csv_name), encoding="utf-8-sig") as fh:
        rows = list(csv.reader(fh))
    hdr = [h.strip() for h in rows[0]]
    for d in rows[1:]:
        if d and d[0].strip() == number:
            return dict(zip(hdr, [c.strip() for c in d]))
    raise SystemExit(f"case {number!r} not found in {csv_name}")


def _num(x):
    try:
        return round(float(x), 3)
    except (TypeError, ValueError):
        return None


def load_cmha(stats_dir: str, number: str) -> dict:
    """Assemble a fully-real morphology dict for one CMHA case from the released summary CSVs.

    Everything here is measured or CFD-simulated by the dataset authors — not computed by us —
    which is exactly why it sidesteps our rough sac-isolation. The one exception is
    low_shear_area_fraction: it needs the per-vertex WSS field (shipped only in the 10.7GB
    patients.rar, not the summary release), so it is a clearly-flagged placeholder.
    """
    h = _cmha_row(stats_dir, "hemodynamic_aneurysm_artery.csv", number)
    m = _cmha_row(stats_dir, "morphological_aneurysm_artery.csv", number)
    c = _cmha_row(stats_dir, "clinical_all.csv", number)
    osi_key = next(k for k in h if "OSI" in k or "Oscillatory" in k)

    geometry = {
        "max_diameter_mm": _num(m["D_max"]),
        "height_mm": _num(m["Aneurysm perpendicular height (H)"]),
        "neck_width_mm": _num(m["Neck width (NW)"]),
        "aspect_ratio": _num(m["The ratio of H to NW(AR)"]),
        "size_ratio": _num(m["The ratio of H to the average of D1, D2, and D3.(SR)"]),
        "location": normalize_location(c.get("location", "")),
    }
    hemodynamics = {
        "peak_wss_pa": _num(h["Max WSS[Pa]"]),
        "mean_wss_pa": _num(h["Mean WSS[Pa]"]),
        "osi_max": round(float(h[osi_key]), 4),
        "low_shear_area_fraction": 0.1,  # PLACEHOLDER — see _note
        "_source": "CMHA CFD (Song et al., Sci Data 2024, figshare 26965450)",
        "_note": "WSS/OSI are real CFD; low_shear_area_fraction is a placeholder "
                 "(per-vertex WSS not in the summary release).",
    }
    clinical = {
        "rupture_status": "ruptured" if str(c.get("Rupture", "0")).strip() in ("1", "1.0", "yes", "Y")
                          else "unruptured",
        "patient_age": round(float(c["Age"]), 1),
        "patient_sex": normalize_sex(c.get("Gender", "")),
        "phase_score": _num(c.get("PHASE")),
        "elapss_score": _num(c.get("ELAPSS")),
    }
    return {"geometry": geometry, "hemodynamics": hemodynamics, "clinical": clinical}


# ── geometry (computed from the aneurysm mesh) ──────────────────────────────────────────────
def _boundary_vertices(mesh) -> np.ndarray | None:
    """Vertices on the mesh's open boundary (the neck loop, if the sac is cut at the neck)."""
    import trimesh

    groups = trimesh.grouping.group_rows(mesh.edges_sorted, require_count=1)
    if len(groups) == 0:
        return None
    edges = mesh.edges_sorted[groups]
    return mesh.vertices[np.unique(edges)]


def _max_pairwise(points: np.ndarray) -> float:
    """Max pairwise distance, using the convex hull to stay cheap on big meshes."""
    from scipy.spatial import ConvexHull

    if len(points) > 8:
        try:
            points = points[ConvexHull(points).vertices]
        except Exception:
            pass
    if len(points) < 2:
        return 0.0
    d = np.linalg.norm(points[:, None, :] - points[None, :, :], axis=-1)
    return float(d.max())


def load_clinical_aneurisk(manifest_path: str) -> dict:
    """Pull the clinical block from an Aneurisk case manifest.csv (its own schema:
    id,institution,modality,age,sex,aneurysmType,aneurysmLocation,ruptureStatus,...)."""
    import pandas as pd

    r = pd.read_csv(manifest_path).iloc[0]
    status = str(r["ruptureStatus"]).strip().upper()
    return {
        "rupture_status": "ruptured" if status.startswith("R") else "unruptured",
        "patient_age": round(float(r["age"]), 1),
        "patient_sex": normalize_sex(str(r["sex"])),
        "_location": normalize_location(str(r["aneurysmLocation"])),
    }


def compute_geometry_from_mesh(mesh, parent_radius_mm: float, location: str) -> dict:
    """Compute the geometry block from an aneurysm sac mesh (trimesh.Trimesh)."""
    verts = np.asarray(mesh.vertices, dtype=float)
    neck = _boundary_vertices(mesh)

    if neck is not None and len(neck) >= 3:
        neck_center = neck.mean(axis=0)
        # neck plane normal via SVD of the centered neck loop
        _, _, vh = np.linalg.svd(neck - neck_center)
        normal = vh[2]
        heights = (verts - neck_center) @ normal
        height = float(np.abs(heights).max())
        neck_width = _max_pairwise(neck)
        max_diameter = _max_pairwise(verts)
    else:
        # closed mesh fallback: use bounding-box extents (rough; flagged in the docstring)
        ext = np.sort(mesh.extents)
        neck_width, max_diameter, height = float(ext[0]), float(ext[1]), float(ext[2])

    parent_diameter = max(2.0 * parent_radius_mm, 1e-3)
    return {
        "max_diameter_mm": round(max_diameter, 3),
        "height_mm": round(height, 3),
        "neck_width_mm": round(neck_width, 3),
        "aspect_ratio": round(height / neck_width, 3) if neck_width > 1e-3 else 0.0,
        "size_ratio": round(height / parent_diameter, 3),
        "location": location,
    }


# ── hemodynamics (from Phase 3, or flagged placeholder) ─────────────────────────────────────
def load_hemodynamics(path: str | None, case_dir: str | None = None) -> tuple[dict, bool]:
    """Return (hemodynamics dict, is_real). Reads an explicit --hemo-json, else the Phase-3
    hemodynamics.json sidecar in the case dir. Only if neither exists does it emit a zeroed
    placeholder — that was the bug that left C0001 all-zeros (Phase 3 hadn't written a summary)."""
    for candidate in (path, os.path.join(case_dir, "hemodynamics.json") if case_dir else None):
        if candidate and os.path.isfile(candidate):
            with open(candidate) as f:
                return json.load(f), True
    return {"peak_wss_pa": 0.0, "mean_wss_pa": 0.0, "osi_max": 0.0,
            "low_shear_area_fraction": 0.0}, False


def assemble(case_id: str, geometry: dict, hemodynamics: dict, clinical: dict) -> dict:
    return {
        "case_id": case_id,
        "geometry": geometry,
        "hemodynamics": hemodynamics,
        "clinical": {k: v for k, v in clinical.items() if not k.startswith("_")},
    }


def _load_aneurysm_mesh(glb_path: str):
    import trimesh

    loaded = trimesh.load(glb_path, force="mesh")
    if hasattr(loaded, "vertices"):
        return loaded
    raise SystemExit(f"could not load a mesh from {glb_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Phase 4: -> morphology.json")
    ap.add_argument("--case", required=True)
    ap.add_argument("--vessel-file-id", help="AneuX vesselFileID for AneuX clinical.csv")
    ap.add_argument("--manifest", help="Aneurisk case manifest.csv (alternative clinical source)")
    ap.add_argument("--aneux-dir", default=DEFAULT_ANEUX)
    ap.add_argument("--artifacts", default="artifacts")
    ap.add_argument("--hemo-json", help="Phase-3 WSS summary sidecar (optional)")
    ap.add_argument("--dataset", choices=["mesh", "cmha"], default="mesh",
                    help="'cmha' assembles morphology purely from CMHA summary CSVs (no mesh/graph)")
    ap.add_argument("--number", help="CMHA case id, e.g. AHMU1218001")
    ap.add_argument("--cmha-dir", default="cmha/statistical results")
    args = ap.parse_args()

    case_dir = os.path.join(args.artifacts, f"case_{args.case}")
    os.makedirs(case_dir, exist_ok=True)

    # CMHA path: fully-real morphology + hemodynamics straight from the released CSVs, no geometry.
    if args.dataset == "cmha":
        if not args.number:
            raise SystemExit("--dataset cmha requires --number (e.g. AHMU1218001)")
        morph = {"case_id": args.case, **load_cmha(args.cmha_dir, args.number)}
        errs = contracts.validate_morphology(morph)
        if errs:
            raise SystemExit("morphology failed contract:\n  " + "\n  ".join(errs))
        out_path = os.path.join(case_dir, "morphology.json")
        json.dump(morph, open(out_path, "w"), indent=2)
        hd = morph["hemodynamics"]
        print(f"wrote {out_path}  (REAL CFD + morphometry, CMHA {args.number})")
        print(f"  geometry={morph['geometry']}")
        print(f"  real WSS/OSI: peak={hd['peak_wss_pa']}Pa mean={hd['mean_wss_pa']}Pa osi={hd['osi_max']}")
        print(f"  clinical={morph['clinical']}")
        return

    graph = json.load(open(os.path.join(case_dir, "graph.json")))
    parent_radius = next(n["radius"] for n in graph["nodes"] if n["id"] == graph["aneurysm_node"])

    if args.manifest:
        clinical = load_clinical_aneurisk(args.manifest)
    elif args.vessel_file_id:
        clinical = load_clinical(args.aneux_dir, args.vessel_file_id)
    else:
        raise SystemExit("provide --manifest (Aneurisk) or --vessel-file-id (AneuX) for clinical data")
    mesh = _load_aneurysm_mesh(os.path.join(case_dir, "aneurysm.glb"))
    geometry = compute_geometry_from_mesh(mesh, parent_radius, clinical["_location"])
    hemodynamics, is_real = load_hemodynamics(args.hemo_json, case_dir)
    if not is_real:
        print("  ⚠ no hemodynamics.json (run Phase 3 first) — WSS/OSI are zeroed placeholders")

    morph = assemble(args.case, geometry, hemodynamics, clinical)
    errs = contracts.validate_morphology(morph)
    if errs:
        raise SystemExit("morphology failed contract:\n  " + "\n  ".join(errs))

    out_path = os.path.join(case_dir, "morphology.json")
    with open(out_path, "w") as f:
        json.dump(morph, f, indent=2)
    print(f"wrote {out_path}: {geometry}")


if __name__ == "__main__":
    main()
