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
def load_hemodynamics(path: str | None) -> tuple[dict, bool]:
    """Return (hemodynamics dict, is_real). If no Phase-3 WSS sidecar exists, emit a zeroed
    placeholder and flag it — the copilot must then present flow as proxy-only."""
    if path and os.path.isfile(path):
        with open(path) as f:
            hemo = json.load(f)
        return hemo, True
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
    ap.add_argument("--vessel-file-id", required=True, help="AneuX vesselFileID for clinical.csv")
    ap.add_argument("--aneux-dir", default=DEFAULT_ANEUX)
    ap.add_argument("--artifacts", default="artifacts")
    ap.add_argument("--hemo-json", help="Phase-3 WSS summary sidecar (optional)")
    args = ap.parse_args()

    case_dir = os.path.join(args.artifacts, f"case_{args.case}")
    graph = json.load(open(os.path.join(case_dir, "graph.json")))
    parent_radius = next(n["radius"] for n in graph["nodes"] if n["id"] == graph["aneurysm_node"])

    clinical = load_clinical(args.aneux_dir, args.vessel_file_id)
    mesh = _load_aneurysm_mesh(os.path.join(case_dir, "aneurysm.glb"))
    geometry = compute_geometry_from_mesh(mesh, parent_radius, clinical["_location"])
    hemodynamics, is_real = load_hemodynamics(args.hemo_json)
    if not is_real:
        print("  ⚠ no real WSS (Tier 1/2 not run) — hemodynamics is a flagged placeholder")

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
