#!/usr/bin/env python3
"""
Aneurysm sac detection & isolation (Ronuk) — the established geometric detector.

The max-inscribed-radius heuristic in Phase 2 mislocalizes the sac (it lands on the widest
*vessel* segment, e.g. the carotid siphon, not the aneurysm). This module uses the standard
centerline-deviation method: the aneurysm sac is the connected surface region whose wall sits
far BEYOND the local vessel radius (a bulge off the tube), i.e. distance-to-centerline − radius.
It isolates the real sac, re-tags the graph, and recomputes morphology + catheter routes from it.

Runs on the data we already have (a vessel surface + its centerline with radii) — no GPU, no
trained model needed. (A trained detector, e.g. an ADAM-challenge nnU-Net, would instead run on
a TOF-MRA/CTA *volume* — applicable to the reconstruction case, not this surface geometry.)

Usage:
    python pipeline/aneurysm_detect.py --case C0001 \
        --surface aneurisk/C0001/surface/model.vtp \
        --centerline aneurisk/C0001/morphology/centerlines.vtp \
        --manifest aneurisk/C0001/manifest.csv --dev-mm 2.0
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
from collections import Counter

import numpy as np
from scipy.spatial import cKDTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import sys
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "pipeline"))
import contracts  # noqa: E402
from _common import read_centerline  # noqa: E402


def _load(mod: str):
    spec = importlib.util.spec_from_file_location(mod[:-3], os.path.join(ROOT, "pipeline", mod))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def detect_sac(surface_path: str, centerline_path: str, dev_mm: float = 2.0):
    """Return (sac_trimesh, centroid, parent_radius_mm) for the largest wall bulge.

    dev = distance(surface vertex → nearest centerline point) − radius(that point). Vertices with
    dev > dev_mm are 'beyond the vessel wall'; the largest connected such region is the sac.
    """
    import pyvista as pv
    import trimesh

    surf = pv.read(surface_path).extract_surface().triangulate()
    V = np.asarray(surf.points)
    cpts, crad, _pl, _ = read_centerline(centerline_path)
    cpts, crad = np.asarray(cpts), np.asarray(crad)
    d, idx = cKDTree(cpts).query(V)
    dev = d - crad[idx]

    sac = surf.extract_points(dev > dev_mm, adjacent_cells=False).extract_surface()
    sac = sac.connectivity("largest")
    pts = np.asarray(sac.points)
    faces = sac.faces.reshape(-1, 4)[:, 1:]
    mesh = trimesh.Trimesh(pts, faces, process=False)
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, face_colors=[242, 140, 38, 255])
    centroid = pts.mean(0)
    parent_radius = float(crad[idx].mean())
    return mesh, centroid, parent_radius


def main() -> None:
    ap = argparse.ArgumentParser(description="Detect & isolate the aneurysm sac (centerline deviation)")
    ap.add_argument("--case", required=True)
    ap.add_argument("--surface", required=True, help=".vtp/.stl vessel surface")
    ap.add_argument("--centerline", required=True, help=".vtp centerline with radii")
    ap.add_argument("--manifest", help="Aneurisk manifest.csv (clinical for morphology)")
    ap.add_argument("--dev-mm", type=float, default=2.0, help="wall-bulge threshold beyond radius")
    ap.add_argument("--artifacts", default="artifacts")
    args = ap.parse_args()

    morph = _load("04_morphology.py")
    qa = _load("graph_qa.py")
    cdir = os.path.join(args.artifacts, f"case_{args.case}")

    # 1. detect + write the real sac as aneurysm.glb
    mesh, centroid, parent_r = detect_sac(args.surface, args.centerline, args.dev_mm)
    mesh.export(os.path.join(cdir, "aneurysm.glb"))
    print(f"sac: {len(mesh.vertices)} verts  centroid={centroid.round(2)}  parent_r={parent_r:.2f}mm")

    # 2. re-tag the graph: add a dedicated aneurysm node linked to the nearest vessel node
    gpath = os.path.join(cdir, "graph.json")
    g = json.load(open(gpath))
    gpos = np.array([n["pos"] for n in g["nodes"]])
    near = g["nodes"][int(np.argmin(np.linalg.norm(gpos - centroid, axis=1)))]
    old_an = g["aneurysm_node"]
    new_id = max(n["id"] for n in g["nodes"]) + 1
    new_eid = max(e["id"] for e in g["edges"]) + 1
    seg = float(np.linalg.norm(np.array(near["pos"]) - centroid))
    cxyz = [float(round(x, 4)) for x in centroid]
    g["nodes"].append({"id": new_id, "pos": cxyz, "type": "aneurysm", "radius": round(parent_r, 3)})
    g["edges"].append({"id": new_eid, "source": near["id"], "target": new_id,
                       "length_mm": round(seg, 3), "mean_radius_mm": round(parent_r, 3),
                       "tortuosity": 1.0, "polyline": [[float(v) for v in near["pos"]], cxyz]})
    g["aneurysm_node"] = new_id
    deg = Counter()
    for e in g["edges"]:
        deg[e["source"]] += 1
        deg[e["target"]] += 1
    for n in g["nodes"]:
        if n["id"] == old_an:
            n["type"] = "endpoint" if deg[n["id"]] == 1 else "bifurcation"
    errs = contracts.validate_graph(g)
    if errs:
        raise SystemExit("graph failed contract:\n  " + "\n  ".join(errs))
    json.dump(g, open(gpath, "w"), indent=2)
    print(f"graph: aneurysm_node {old_an} -> {new_id} (near vessel node {near['id']}, {seg:.1f}mm)")

    # 3. recompute morphology from the real sac + catheter routes to the corrected node
    geom = morph.compute_geometry_from_mesh(mesh, parent_r, morph.normalize_location("ICA"))
    if args.manifest:
        clin = morph.load_clinical_aneurisk(args.manifest)
        hemo, _ = morph.load_hemodynamics(None)
        mj = morph.assemble(args.case, geom, hemo, clin)
        if not contracts.validate_morphology(mj):
            json.dump(mj, open(os.path.join(cdir, "morphology.json"), "w"), indent=2)
    print(f"morphology (from real sac): {geom}")

    routes = qa.catheter_routes(g)
    json.dump({"case_id": args.case, "units": "mm", "routes": routes},
              open(os.path.join(cdir, "catheter_paths.json"), "w"), indent=2)
    print(f"catheter routes: {[(r['entry_node'], r['length_mm']) for r in routes]}")
    print("SANITY:", "PASS" if not qa.sanity_check(g) else "FAIL")


if __name__ == "__main__":
    main()
