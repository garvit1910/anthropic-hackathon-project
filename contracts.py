"""
contracts.py — the interface contract between the pipeline (Ronuk) and the app (Garvit).

This is the ONE file both builders own; change it only by joint agreement. Ronuk's pipeline
must EMIT exactly these schemas; Garvit's app CONSUMES exactly these. As long as both obey
this file, the real artifacts drop in where the mock artifacts were and the merge is clean.

Stdlib only — no third-party imports — so it runs identically in the pipeline conda env and
the agent env.

────────────────────────────────────────────────────────────────────────────────────────────
WORLD FRAME (fixed once, here):
    * Units:    millimetres (mm) for every coordinate, length, and radius.
    * Up axis:  Y-up.
    * Frame:    vessel_tree.glb, aneurysm.glb, and graph.json all live in ONE shared world
                frame — they must overlay exactly when loaded together.
    * WSS:      wall shear stress is baked as a per-vertex color (COLOR_0) on aneurysm.glb.
                (The alternative — a wss.json sidecar — is NOT used. One convention, chosen.)
────────────────────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import json
import os
import struct
from typing import Any

# ── Fixed conventions (documented once, referenced everywhere) ──────────────────────────────
UNITS = "mm"
UP_AXIS = "Y"
WSS_CONVENTION = "aneurysm_glb_COLOR_0"  # per-vertex color on aneurysm.glb (not a sidecar)

# The five files that make up one complete case (the handoff).
REQUIRED_FILES = (
    "vessel_tree.glb",
    "aneurysm.glb",
    "graph.json",
    "streamlines.json",
    "morphology.json",
)

# Controlled vocabularies.
NODE_TYPES = {"endpoint", "bifurcation", "aneurysm", "entry"}
LOCATIONS = {"ICA", "MCA", "ACA", "AComm", "PComm", "BA", "VA", "other"}
RUPTURE_STATUS = {"ruptured", "unruptured"}
SEX_VALUES = {"M", "F", "unknown"}


# ── Small validation helpers ────────────────────────────────────────────────────────────────
def _is_number(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _is_vec3(x: Any) -> bool:
    return isinstance(x, (list, tuple)) and len(x) == 3 and all(_is_number(v) for v in x)


def _require(obj: dict, key: str, errs: list[str], where: str) -> bool:
    if key not in obj:
        errs.append(f"{where}: missing required key '{key}'")
        return False
    return True


# ── graph.json ──────────────────────────────────────────────────────────────────────────────
def validate_graph(obj: dict) -> list[str]:
    """Return a list of human-readable errors ([] means valid)."""
    errs: list[str] = []
    for k in ("case_id", "units", "nodes", "edges", "aneurysm_node", "entry_nodes"):
        _require(obj, k, errs, "graph.json")
    if errs:
        return errs

    if obj["units"] != UNITS:
        errs.append(f"graph.json: units must be '{UNITS}', got {obj['units']!r}")

    node_ids: set[int] = set()
    for i, n in enumerate(obj["nodes"]):
        w = f"graph.json nodes[{i}]"
        if not _require(n, "id", errs, w):
            continue
        node_ids.add(n["id"])
        if not _is_vec3(n.get("pos")):
            errs.append(f"{w}: 'pos' must be [x,y,z] numbers")
        if n.get("type") not in NODE_TYPES:
            errs.append(f"{w}: 'type' must be one of {sorted(NODE_TYPES)}, got {n.get('type')!r}")
        if not _is_number(n.get("radius")):
            errs.append(f"{w}: 'radius' must be a number")

    for i, e in enumerate(obj["edges"]):
        w = f"graph.json edges[{i}]"
        for k in ("id", "source", "target", "length_mm", "mean_radius_mm", "tortuosity", "polyline"):
            _require(e, k, errs, w)
        if e.get("source") not in node_ids:
            errs.append(f"{w}: 'source' {e.get('source')} is not a defined node id")
        if e.get("target") not in node_ids:
            errs.append(f"{w}: 'target' {e.get('target')} is not a defined node id")
        if _is_number(e.get("tortuosity")) and e["tortuosity"] < 1.0:
            errs.append(f"{w}: 'tortuosity' must be >= 1.0 (path/straight-line), got {e['tortuosity']}")
        poly = e.get("polyline")
        if not isinstance(poly, list) or not all(_is_vec3(p) for p in poly):
            errs.append(f"{w}: 'polyline' must be a list of [x,y,z] points")

    if obj["aneurysm_node"] not in node_ids:
        errs.append(f"graph.json: aneurysm_node {obj['aneurysm_node']} is not a defined node id")
    for en in obj["entry_nodes"]:
        if en not in node_ids:
            errs.append(f"graph.json: entry_node {en} is not a defined node id")
    return errs


# ── morphology.json ───────────────────────────────────────────────────────────────────────
def validate_morphology(obj: dict) -> list[str]:
    errs: list[str] = []
    for k in ("case_id", "geometry", "hemodynamics", "clinical"):
        _require(obj, k, errs, "morphology.json")
    if errs:
        return errs

    geo = obj["geometry"]
    for k in ("max_diameter_mm", "height_mm", "neck_width_mm", "aspect_ratio", "size_ratio"):
        if not _is_number(geo.get(k)):
            errs.append(f"morphology.json geometry.{k}: must be a number")
    if geo.get("location") not in LOCATIONS:
        errs.append(f"morphology.json geometry.location: must be one of {sorted(LOCATIONS)}, got {geo.get('location')!r}")

    hemo = obj["hemodynamics"]
    for k in ("peak_wss_pa", "mean_wss_pa", "osi_max", "low_shear_area_fraction"):
        if not _is_number(hemo.get(k)):
            errs.append(f"morphology.json hemodynamics.{k}: must be a number")

    clin = obj["clinical"]
    if clin.get("rupture_status") not in RUPTURE_STATUS:
        errs.append(f"morphology.json clinical.rupture_status: must be one of {sorted(RUPTURE_STATUS)}")
    if not _is_number(clin.get("patient_age")):
        errs.append("morphology.json clinical.patient_age: must be a number")
    if clin.get("patient_sex") not in SEX_VALUES:
        errs.append(f"morphology.json clinical.patient_sex: must be one of {sorted(SEX_VALUES)}")
    return errs


# ── streamlines.json ─────────────────────────────────────────────────────────────────────
def validate_streamlines(obj: dict) -> list[str]:
    errs: list[str] = []
    for k in ("case_id", "streamlines"):
        _require(obj, k, errs, "streamlines.json")
    if errs:
        return errs
    if not isinstance(obj["streamlines"], list):
        errs.append("streamlines.json: 'streamlines' must be a list")
        return errs
    for i, s in enumerate(obj["streamlines"]):
        w = f"streamlines.json streamlines[{i}]"
        pts = s.get("points")
        spd = s.get("speed")
        if not isinstance(pts, list) or not all(_is_vec3(p) for p in pts):
            errs.append(f"{w}: 'points' must be a list of [x,y,z]")
        if not isinstance(spd, list) or not all(_is_number(v) for v in spd):
            errs.append(f"{w}: 'speed' must be a list of numbers")
        elif isinstance(pts, list) and len(pts) != len(spd):
            errs.append(f"{w}: 'points' ({len(pts)}) and 'speed' ({len(spd)}) length mismatch")
    return errs


# ── GLB (lightweight structural check — no mesh library needed) ─────────────────────────────
def validate_glb(path: str) -> list[str]:
    """Check that a file is a structurally valid GLB (magic + version + chunk framing).

    This intentionally does NOT load meshes (which would need trimesh/pygltflib), so the
    validator runs in any environment. A full mesh-load check belongs in the pipeline env.
    """
    errs: list[str] = []
    try:
        with open(path, "rb") as f:
            header = f.read(12)
            if len(header) < 12:
                return [f"{os.path.basename(path)}: file too short to be a GLB"]
            magic, version, length = struct.unpack("<4sII", header)
            if magic != b"glTF":
                errs.append(f"{os.path.basename(path)}: bad magic {magic!r} (expected b'glTF')")
            if version != 2:
                errs.append(f"{os.path.basename(path)}: GLB version {version} (expected 2)")
            actual = os.path.getsize(path)
            if length != actual:
                errs.append(f"{os.path.basename(path)}: header length {length} != file size {actual}")
    except FileNotFoundError:
        errs.append(f"{os.path.basename(path)}: file not found")
    except Exception as exc:  # pragma: no cover
        errs.append(f"{os.path.basename(path)}: unreadable ({exc})")
    return errs


# ── whole-case validation ───────────────────────────────────────────────────────────────────
_JSON_VALIDATORS = {
    "graph.json": validate_graph,
    "morphology.json": validate_morphology,
    "streamlines.json": validate_streamlines,
}


def validate_case(case_dir: str) -> list[str]:
    """Validate one case_*/ folder against the full contract. [] means it passes."""
    errs: list[str] = []

    # 1. all required files present
    for fname in REQUIRED_FILES:
        if not os.path.isfile(os.path.join(case_dir, fname)):
            errs.append(f"missing required file: {fname}")

    # 2. GLBs are structurally valid
    for glb in ("vessel_tree.glb", "aneurysm.glb"):
        p = os.path.join(case_dir, glb)
        if os.path.isfile(p):
            errs.extend(validate_glb(p))

    # 3. JSON files match their schema
    parsed: dict[str, dict] = {}
    for fname, validator in _JSON_VALIDATORS.items():
        p = os.path.join(case_dir, fname)
        if not os.path.isfile(p):
            continue
        try:
            with open(p) as f:
                obj = json.load(f)
        except json.JSONDecodeError as exc:
            errs.append(f"{fname}: invalid JSON ({exc})")
            continue
        parsed[fname] = obj
        errs.extend(validator(obj))

    # 4. cross-file consistency: case_id agrees everywhere
    case_ids = {name: obj.get("case_id") for name, obj in parsed.items() if "case_id" in obj}
    if len(set(case_ids.values())) > 1:
        errs.append(f"case_id mismatch across files: {case_ids}")

    return errs
