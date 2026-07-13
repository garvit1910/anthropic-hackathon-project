#!/usr/bin/env python3
"""
HERO case builder — the complete-vasculature interrogable aneurysm (Ronuk).

One case that has EVERYTHING: the whole cerebral vasculature reconstructed from a raw TOF-MRA,
a REAL aneurysm (the dataset's manual mask — not fabricated), the optimal endovascular catheter
route threading up through the whole tree to the sac, plus flow, a WSS heatmap, and morphology —
the substrate the Claude agent tools reason over.

Source: Lausanne TOF-MRA Aneurysm Cohort (OpenNeuro ds003949), a patient subject with a manual
aneurysm mask. Reuses the Phase 2-4 pipeline; nothing here is bespoke physics.

    python pipeline/build_hero.py --case HERO_sub013 \
        --brain lausanne/sub-013/brain.nii.gz --aneurysm-mask lausanne/sub-013/aneurysm_mask.nii.gz
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from collections import Counter

import numpy as np
import nibabel as nib
from scipy import ndimage
from skimage.measure import marching_cubes
from skimage.morphology import remove_small_objects

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "pipeline"))
import contracts  # noqa: E402


def _load(mod):
    spec = importlib.util.spec_from_file_location(mod[:-3].replace("0", "p"),
                                                  os.path.join(ROOT, "pipeline", mod))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def _smoothed_glb(mask, aff, out, color):
    import pyvista as pv
    import trimesh
    verts, faces, _n, _v = marching_cubes(mask.astype(np.float32), level=0.5)
    verts = nib.affines.apply_affine(aff, verts)
    pd = pv.PolyData(verts, np.hstack([np.full((len(faces), 1), 3), faces]).astype(np.int64))
    pd = pd.smooth_taubin(n_iter=25, pass_band=0.08)
    sv, sf = np.asarray(pd.points), pd.faces.reshape(-1, 4)[:, 1:]
    m = trimesh.Trimesh(sv, sf, process=False)
    m.visual = trimesh.visual.ColorVisuals(mesh=m, face_colors=color)
    m.export(out)
    return len(sv)


def main() -> None:
    ap = argparse.ArgumentParser(description="Build the complete-vasculature hero aneurysm case")
    ap.add_argument("--case", required=True)
    ap.add_argument("--brain", required=True, help="skull-stripped TOF-MRA intensity volume")
    ap.add_argument("--aneurysm-mask", required=True, help="binary aneurysm mask (same space)")
    ap.add_argument("--iso", type=float, default=0.5)
    ap.add_argument("--vessel-percentile", type=float, default=97.0)
    ap.add_argument("--min-vox", type=int, default=150)
    ap.add_argument("--artifacts", default="artifacts")
    args = ap.parse_args()

    g2 = _load("02_graph.py")
    skel = _load("skeleton_graph.py")
    cfd = _load("03_cfd.py")
    morph = _load("04_morphology.py")
    qa = _load("graph_qa.py")
    cdir = os.path.join(args.artifacts, f"case_{args.case}")
    os.makedirs(cdir, exist_ok=True)

    # 1. resolution correction -> isotropic
    img = nib.load(args.brain)
    vol = img.get_fdata().astype(np.float32)
    zooms = np.array(img.header.get_zooms()[:3], float)
    f = zooms / args.iso
    voli = ndimage.zoom(vol, f, order=1)
    aff = img.affine.copy()
    for i in range(3):
        aff[:3, i] = img.affine[:3, i] / f[i]
    brain = voli > 0
    print(f"resampled {vol.shape}@{zooms.round(3)} -> {voli.shape}@{args.iso}mm ({voli.size/1e6:.1f}M vox)")

    # 2. whole-brain vessel segmentation (intensity, keep sizable components)
    thr = np.percentile(voli[brain], args.vessel_percentile)
    vmask = ndimage.binary_opening((voli > thr) & brain, iterations=1)
    vmask = remove_small_objects(vmask, min_size=args.min_vox)
    lbl, n = ndimage.label(vmask)
    keep = np.where(ndimage.sum(vmask, lbl, range(1, n + 1)) >= args.min_vox)[0] + 1
    vmask = ndimage.binary_closing(np.isin(lbl, keep), iterations=1)
    print(f"vessels: {int(vmask.sum())} voxels, {len(keep)} components")
    nv = _smoothed_glb(vmask, aff, os.path.join(cdir, "vessel_tree.glb"), [224, 72, 58, 255])
    print(f"vessel_tree.glb: {nv} verts")

    # 3. REAL aneurysm from the manual mask
    amimg = nib.load(args.aneurysm_mask)
    amask = amimg.get_fdata() > 0
    acentroid = nib.affines.apply_affine(amimg.affine, np.argwhere(amask).mean(0))
    na = _smoothed_glb(amask, amimg.affine, os.path.join(cdir, "aneurysm.glb"), [242, 140, 38, 255])
    print(f"aneurysm.glb: {na} verts, centroid {acentroid.round(1)}mm")

    # 4. whole-brain centerline graph, aneurysm tagged at the real sac
    pts, radius, polylines = skel.skeleton_polylines(vmask, aff, args.iso, prune_mm=2.0, smooth_sigma=0)
    print(f"skeleton: {len(pts)} points, {len(polylines)} branches")
    graph = g2.build_graph_json(args.case, pts, radius, polylines, aneurysm_pos=acentroid, n_entries=2)
    graph = skel.merge_close_nodes(graph, 2.0)
    errs = contracts.validate_graph(graph)
    if errs:
        raise SystemExit("graph failed contract:\n  " + "\n  ".join(errs))
    json.dump(graph, open(os.path.join(cdir, "graph.json"), "w"), indent=2)
    print(f"graph: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges, "
          f"{dict(Counter(n['type'] for n in graph['nodes']))}, aneurysm={graph['aneurysm_node']}, "
          f"entries={graph['entry_nodes']}")

    # 5. flow + hemodynamics + catheter routes + morphology + WSS heatmap
    json.dump({"case_id": args.case, "streamlines": cfd.analytic_streamlines(graph)},
              open(os.path.join(cdir, "streamlines.json"), "w"), indent=2)
    hemo = cfd.analytic_hemodynamics(graph)
    routes = qa.catheter_routes(graph)
    json.dump({"case_id": args.case, "units": "mm", "routes": routes},
              open(os.path.join(cdir, "catheter_paths.json"), "w"), indent=2)

    import trimesh
    sac = trimesh.load(os.path.join(cdir, "aneurysm.glb"), force="mesh")
    parent_r = float(next(n["radius"] for n in graph["nodes"] if n["id"] == graph["aneurysm_node"]))
    geom = morph.compute_geometry_from_mesh(sac, parent_r, "other")   # anonymized dataset: location=other
    clinical = {"rupture_status": "unruptured", "patient_age": 60.0, "patient_sex": "unknown",
                "_note": "ds003949 is anonymized (no age/sex/rupture); rupture assumed unruptured "
                         "(incidental imaging-cohort aneurysm), age is a placeholder."}
    mj = morph.assemble(args.case, geom, hemo, clinical)
    errs = contracts.validate_morphology(mj)
    if errs:
        raise SystemExit("morphology failed contract:\n  " + "\n  ".join(errs))
    json.dump(mj, open(os.path.join(cdir, "morphology.json"), "w"), indent=2)

    cfd.bake_wss_heatmap(cdir)   # per-vertex WSS -> COLOR_0 on aneurysm.glb + wss.json

    print(f"catheter routes: {[(r['entry_node'], r['length_mm']) for r in routes]}")
    print(f"morphology: {geom}")
    print("SANITY:", "PASS" if not qa.sanity_check(graph) else "FAIL")
    print("VALIDATE:", "PASS" if not contracts.validate_case(cdir) else contracts.validate_case(cdir))


if __name__ == "__main__":
    main()
