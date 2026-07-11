#!/usr/bin/env python3
"""
PHASE 4 — Morphology & Feature Extraction (Ronuk).

Goal: measure the aneurysm — the numbers a clinician and a rupture-risk score actually use.
This is the factual backbone of Claude's risk reasoning (get_morphology reads this file).

Inputs:  aneurysm mesh + centerline (+ AneuX's precomputed indices if available) + Phase 3
         hemodynamic summaries.
Output:  morphology.json (contract schema).

Two paths:
    * Fast path: pull relevant fields from AneuX's precomputed morphometric indices +
      clinical.csv (rupture status, location, age, sex). Real data, already on disk.
    * Compute path (and for the reconstructed case): max diameter, height, neck width,
      aspect ratio (height / neck), size ratio (dome / parent-vessel radius at the aneurysm
      node), location.

AneuX bundle layout (this repo, git-ignored):
    zenodo_aneux/data/clinical.csv        source,dataset,hospital,status,location,side,sex,age,...
    zenodo_aneux/data/morpho-per-cut.csv  173-col morphometric index table (hierarchical header;
                                          see zenodo_aneux/content-description-v1.0.pdf for names)

Runs in the `neurovas` conda env (pandas, numpy).
"""

from __future__ import annotations

import argparse
import json
import os

import contracts

DEFAULT_ANEUX = os.path.join(os.path.dirname(__file__), "..", "zenodo_aneux", "data")

# AneuX free-text locations -> the contract's controlled vocabulary.
_LOCATION_MAP = {
    "ICA": "ICA", "MCA": "MCA", "ACA": "ACA", "ACOM": "AComm", "ACOMM": "AComm",
    "PCOM": "PComm", "PCOMM": "PComm", "BA": "BA", "BAS": "BA", "VA": "VA",
}


def normalize_location(raw: str) -> str:
    """Map a free-text AneuX location (e.g. 'ICA oph', 'VA V4') to a contract LOCATIONS value."""
    if not raw:
        return "other"
    token = raw.strip().upper().split()[0]
    return _LOCATION_MAP.get(token, "other")


def normalize_sex(raw: str) -> str:
    r = (raw or "").strip().lower()
    return {"female": "F", "f": "F", "male": "M", "m": "M"}.get(r, "unknown")


# ── Fast path: read clinical.csv for a chosen case ──────────────────────────────────────────
def load_clinical(aneux_dir: str, vessel_file_id: str) -> dict:
    """Pull the clinical block for one AneuX case (keyed by vesselFileID)."""
    import pandas as pd

    df = pd.read_csv(os.path.join(aneux_dir, "clinical.csv"))
    row = df[df["vesselFileID"] == vessel_file_id]
    if row.empty:
        raise SystemExit(f"vesselFileID {vessel_file_id!r} not found in clinical.csv")
    r = row.iloc[0]
    return {
        "rupture_status": str(r["status"]).strip().lower(),   # already 'ruptured'/'unruptured'
        "patient_age": float(r["age"]),
        "patient_sex": normalize_sex(str(r["sex"])),
        "_location": normalize_location(str(r["location"])),  # consumed by geometry block
    }


def compute_geometry(aneurysm_mesh, centerline, aneurysm_node) -> dict:
    """Compute the geometric block from mesh + centerline (compute path / reconstructed case).

    aspect_ratio = height / neck_width; size_ratio = aneurysm size / parent-vessel diameter
    (parent diameter from the centerline radius at the aneurysm node).
    """
    # TODO: measure max_diameter_mm, height_mm, neck_width_mm from the mesh + neck plane;
    #       derive aspect_ratio and size_ratio. Location comes from the clinical block.
    raise NotImplementedError("TODO: compute geometry from mesh/centerline")


def assemble(case_id: str, geometry: dict, hemodynamics: dict, clinical: dict) -> dict:
    """Combine the three blocks into the morphology.json contract shape."""
    return {
        "case_id": case_id,
        "geometry": geometry,
        "hemodynamics": hemodynamics,
        "clinical": {k: v for k, v in clinical.items() if not k.startswith("_")},
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Phase 4: -> morphology.json")
    ap.add_argument("--case", required=True)
    ap.add_argument("--vessel-file-id", help="AneuX vesselFileID for the fast (clinical) path")
    ap.add_argument("--aneux-dir", default=DEFAULT_ANEUX)
    ap.add_argument("--artifacts", default="artifacts")
    args = ap.parse_args()

    case_dir = os.path.join(args.artifacts, f"case_{args.case}")

    # clinical = load_clinical(args.aneux_dir, args.vessel_file_id)
    # geometry = compute_geometry(...); geometry["location"] = clinical["_location"]
    # hemodynamics = json.load(open(.../ "_hemo_summary.json"))   # from Phase 3
    # morph = assemble(args.case, geometry, hemodynamics, clinical)
    # errs = contracts.validate_morphology(morph)
    # assert not errs, errs
    # json.dump(morph, open(os.path.join(case_dir, "morphology.json"), "w"), indent=2)
    raise SystemExit("Phase 4 skeleton — clinical fast-path wired to AneuX CSVs; implement geometry compute + assemble.")


if __name__ == "__main__":
    main()
