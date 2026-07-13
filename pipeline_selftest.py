#!/usr/bin/env python3
"""
pipeline_selftest.py — verify the Phase 1-4 logic end-to-end without heavy mesh libraries.

Covers the algorithmic core that doesn't need vtk/pyvista:
  * Phase 2 graph build  — on a synthetic Y-shaped centerline with an aneurysm sac branch.
  * Phase 3 CFD proxy    — analytic streamlines over that graph.
  * Phase 4 morphology   — sac geometry from a synthetic trimesh dome + a tracked clinical fixture.
  * Phase 1 GLB export   — trimesh export + reload round-trip.

Every produced artifact is checked against contracts.py. The one path this does NOT exercise is
reading real Aneurisk .vtp meshes/centerlines (needs vtk/pyvista) — that's tested separately.

Run:  .venv/bin/python pipeline_selftest.py
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys

import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "pipeline"))
import contracts  # noqa: E402


def _load(numbered_file: str):
    """Import a numbered pipeline module (e.g. 02_graph.py) whose name isn't a valid identifier."""
    path = os.path.join(ROOT, "pipeline", numbered_file)
    spec = importlib.util.spec_from_file_location(numbered_file[:-3].replace("0", "p"), path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def synthetic_centerline():
    """Y-shape: two wide inlets -> junction J -> outlet, with a bulging sac branch off the trunk.

    Returns (pts, radius, polylines) as Phase 2 expects. Shared coordinates let the point-merge
    fuse the branches at J and at the sac takeoff S.
    """
    pts, radius, polylines = [], [], []

    def chain(points_radii):
        idx = []
        for (p, r) in points_radii:
            pts.append(p)
            radius.append(r)
            idx.append(len(pts) - 1)
        polylines.append(idx)

    J = (0.0, 0.0, 60.0)     # junction of the two inlets
    S = (0.0, 0.0, 45.0)     # sac takeoff on the trunk
    # inlet A (wide -> entry)
    chain([((-6, 0, 90), 2.1), ((-3, 0, 75), 1.9), (J, 1.7)])
    # inlet B (wide -> entry)
    chain([((6, 0, 90), 2.0), ((3, 0, 75), 1.8), (J, 1.7)])
    # trunk J -> S -> outlet
    chain([(J, 1.7), ((0, 0, 52), 1.6), (S, 1.6), ((0, 0, 30), 1.3), ((0, 0, 18), 1.1)])
    # aneurysm sac branch off S (bulging radius = large inscribed sphere)
    chain([(S, 1.6), ((0, 4, 45), 2.6), ((0, 9, 45), 3.8)])
    return pts, radius, polylines


def synthetic_sac_mesh():
    """An open hemispherical dome (trimesh) — the neck is the open boundary near z=0.

    Built by dropping the lower faces of an icosphere (pure trimesh, no shapely dependency)."""
    import trimesh

    sphere = trimesh.creation.icosphere(subdivisions=3, radius=2.0)
    dome = sphere.copy()
    keep = sphere.triangles_center[:, 2] > 0.15   # drop the bottom cap -> open neck
    dome.update_faces(keep)
    dome.remove_unreferenced_vertices()
    return dome


def check(name, errs):
    status = "PASS" if not errs else "FAIL"
    print(f"  [{status}] {name}")
    if errs:
        for e in errs:
            print(f"        · {e}")
    return not errs


def main() -> int:
    graph_mod = _load("02_graph.py")
    cfd_mod = _load("03_cfd.py")
    morph_mod = _load("04_morphology.py")
    geom_mod = _load("01_geometry.py")

    ok = True
    print("Phase 2 — graph build")
    pts, radius, polylines = synthetic_centerline()
    graph = graph_mod.build_graph_json("C_TEST", pts, radius, polylines,
                                       aneurysm_pos=(0, 9, 45), n_entries=2)
    ok &= check("graph.json matches contract", contracts.validate_graph(graph))
    print(f"        {len(graph['nodes'])} nodes, {len(graph['edges'])} edges, "
          f"aneurysm_node={graph['aneurysm_node']}, entries={graph['entry_nodes']}")

    print("Phase 3 — analytic streamlines")
    streams = {"case_id": "C_TEST", "streamlines": cfd_mod.analytic_streamlines(graph, seeds_per_entry=3)}
    ok &= check("streamlines.json matches contract", contracts.validate_streamlines(streams))
    print(f"        {len(streams['streamlines'])} streamlines")

    print("Phase 4 — morphology (synthetic sac + tracked clinical fixture)")
    sac = synthetic_sac_mesh()
    parent_radius = next(n["radius"] for n in graph["nodes"] if n["id"] == graph["aneurysm_node"])
    clinical = morph_mod.load_clinical_aneurisk(os.path.join(ROOT, "testdata", "manifest.csv"))
    geometry = morph_mod.compute_geometry_from_mesh(sac, parent_radius, clinical["_location"])
    hemo, _ = morph_mod.load_hemodynamics(None)
    morph = morph_mod.assemble("C_TEST", geometry, hemo, clinical)
    ok &= check("morphology.json matches contract", contracts.validate_morphology(morph))
    print(f"        geometry={geometry}")
    print(f"        clinical={morph['clinical']}")

    print("Phase 1 — GLB export round-trip")
    import trimesh
    verts, faces = np.asarray(sac.vertices), np.asarray(sac.faces)
    out = os.path.join(ROOT, ".tmp", "selftest_aneurysm.glb")
    geom_mod.export_glb(verts, faces, out, color=[242, 140, 38, 255])
    reloaded = trimesh.load(out, force="mesh")
    ok &= check("GLB reloads with same vertex count",
                [] if len(reloaded.vertices) == len(verts) else ["vertex count changed on reload"])

    print()
    print("ALL PHASES PASS ✅" if ok else "SELFTEST FAILED ❌")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
