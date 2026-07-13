#!/usr/bin/env python3
"""
Centerline graph from a vessel SURFACE mesh, via voxel skeletonization (Ronuk).

Cases without a provided centerline (CMHA CTA STLs, the Lausanne TOF reconstruction) were not
interrogable — no graph means no catheter routing and no flow. This derives the centerline the
Aneurisk cases ship for free: voxelize+fill the surface, 3D-skeletonize, trace the skeleton into
polylines with per-point radius (from the Euclidean distance transform), then feed the SAME
build_graph_json used in Phase 2. No VMTK / no GPU.

Usage:
    python pipeline/skeleton_graph.py --case CMHA_AHMU1218001 \
        --surface cmha/extract/patients/AHMU1218001/3D_aneurysm_artery_AHMU1218001.stl \
        --aneurysm cmha/extract/patients/AHMU1218001/3D_aneurysm_AHMU1218001.stl \
        --pitch 0.25 --entries 2
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from collections import deque

import numpy as np
from scipy import ndimage

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


def voxelize(mesh_path: str, pitch: float):
    """Surface mesh -> (solid boolean mask, voxel->world-mm affine)."""
    import trimesh

    mesh = trimesh.load(mesh_path, force="mesh")
    vox = mesh.voxelized(pitch=pitch).fill()
    return np.asarray(vox.matrix, dtype=bool), np.asarray(vox.transform, dtype=float)


def skeleton_polylines(mask: np.ndarray, transform: np.ndarray, pitch: float, prune_mm: float = 1.0,
                       smooth_sigma: float = 0.8):
    """Skeletonize the solid mask and trace it into polylines with per-point radius (mm).

    Short dead-end branches (leaves shorter than prune_mm) are surface-noise spurs from
    voxelization — pruned iteratively so the graph reflects real vessels, not bumps.
    Returns (pts Nx3 mm, radius N mm, polylines list[list[int]]) ready for build_graph_json.
    """
    from skimage.morphology import skeletonize

    # smooth surface bumps first (they become spurious skeleton branches), keep largest component
    if smooth_sigma > 0:
        mask = ndimage.gaussian_filter(mask.astype(np.float32), sigma=smooth_sigma) > 0.5
    lbl, n = ndimage.label(mask)
    if n > 1:
        mask = lbl == (1 + int(np.argmax(ndimage.sum(mask, lbl, range(1, n + 1)))))
    skel = skeletonize(mask)
    edt = ndimage.distance_transform_edt(mask) * pitch     # inscribed radius (mm) per voxel
    coords = np.argwhere(skel)
    index = {tuple(c): i for i, c in enumerate(coords)}

    # 26-neighbour adjacency among skeleton voxels
    offs = [(dz, dy, dx) for dz in (-1, 0, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
            if not (dz == dy == dx == 0)]
    nbrs: list[set[int]] = [set() for _ in coords]
    for i, c in enumerate(coords):
        for o in offs:
            j = index.get((c[0] + o[0], c[1] + o[1], c[2] + o[2]))
            if j is not None:
                nbrs[i].add(j)

    mm = np.array([(transform @ np.array([c[0], c[1], c[2], 1.0]))[:3] for c in coords])

    # iteratively prune leaf branches (endpoint -> nearest junction) shorter than prune_mm
    alive = np.ones(len(coords), dtype=bool)
    changed = True
    while changed:
        changed = False
        deg = np.array([sum(alive[n] for n in nbrs[i]) if alive[i] else 0 for i in range(len(coords))])
        for ep in np.where(alive & (deg == 1))[0]:
            branch, prev, cur = [ep], ep, next(n for n in nbrs[ep] if alive[n])
            while sum(alive[n] for n in nbrs[cur]) == 2:      # walk the degree-2 body
                branch.append(cur)
                nxt = [n for n in nbrs[cur] if alive[n] and n != prev]
                if not nxt:
                    break
                prev, cur = cur, nxt[0]
            length = float(np.linalg.norm(np.diff(mm[branch + [cur]], axis=0), axis=1).sum())
            if length < prune_mm and sum(alive[n] for n in nbrs[cur]) >= 3:  # a real spur off a junction
                for v in branch:
                    alive[v] = False
                changed = True

    def deg_alive(i):
        return sum(alive[n] for n in nbrs[i])
    is_node = np.array([alive[i] and deg_alive(i) != 2 for i in range(len(coords))])

    pts: list[list[float]] = []
    radius: list[float] = []
    polylines: list[list[int]] = []

    def add_point(vidx):
        pts.append([float(x) for x in mm[vidx]])
        radius.append(float(edt[tuple(coords[vidx])]))
        return len(pts) - 1

    seen = set()
    for start in np.where(is_node)[0]:
        for first in [n for n in nbrs[start] if alive[n]]:
            if (start, first) in seen:
                continue
            chain, prev, cur = [start, first], start, first
            while not is_node[cur]:
                nxt = [n for n in nbrs[cur] if alive[n] and n != prev]
                if not nxt:
                    break
                prev, cur = cur, nxt[0]
                chain.append(cur)
            seen.update({(chain[0], chain[1]), (chain[1], chain[0]),
                         (chain[-1], chain[-2]), (chain[-2], chain[-1])})
            if len(chain) >= 2:
                polylines.append([add_point(v) for v in chain])
    return np.array(pts, dtype=float), np.array(radius, dtype=float), polylines


def merge_close_nodes(graph: dict, tol_mm: float) -> dict:
    """Collapse junction clusters: voxel skeletons scatter a real bifurcation into several nodes
    within a voxel or two. Union nodes closer than tol_mm, merge parallel edges and drop loops,
    then re-type by degree. Keeps entry/aneurysm tags. Robust to skeleton noise."""
    from collections import defaultdict
    nodes = {n["id"]: n for n in graph["nodes"]}
    ids = list(nodes)
    pos = {i: np.array(nodes[i]["pos"], float) for i in ids}
    parent = {i: i for i in ids}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a in ids:
        for b in ids:
            if a < b and np.linalg.norm(pos[a] - pos[b]) < tol_mm:
                parent[find(a)] = find(b)

    clusters = defaultdict(list)
    for i in ids:
        clusters[find(i)].append(i)
    PRI = {"aneurysm": 3, "entry": 2, "bifurcation": 1, "endpoint": 0}
    old2new, new_nodes = {}, []
    for k, members in enumerate(clusters.values()):
        for i in members:
            old2new[i] = k
        p = np.mean([pos[i] for i in members], axis=0)
        r = max((nodes[i].get("radius") or 0.0) for i in members)
        typ = max((nodes[i]["type"] for i in members), key=lambda t: PRI.get(t, 0))
        new_nodes.append({"id": k, "pos": [round(float(x), 4) for x in p], "type": typ,
                          "radius": round(float(r), 3)})

    new_edges, seen, eid, deg = [], set(), 0, defaultdict(int)
    for e in graph["edges"]:
        s, t = old2new[e["source"]], old2new[e["target"]]
        if s == t or (min(s, t), max(s, t)) in seen:
            continue
        seen.add((min(s, t), max(s, t)))
        new_edges.append({**e, "id": eid, "source": s, "target": t})
        deg[s] += 1
        deg[t] += 1
        eid += 1

    for n in new_nodes:                                     # re-type by degree (keep entry/aneurysm)
        if n["type"] not in ("entry", "aneurysm"):
            n["type"] = "endpoint" if deg[n["id"]] == 1 else "bifurcation"
    graph["nodes"] = new_nodes
    graph["edges"] = new_edges
    graph["aneurysm_node"] = old2new[graph["aneurysm_node"]]
    graph["entry_nodes"] = sorted({old2new[e] for e in graph["entry_nodes"]})
    return graph


def main() -> None:
    ap = argparse.ArgumentParser(description="Centerline graph from a surface mesh (skeletonization)")
    ap.add_argument("--case", required=True)
    ap.add_argument("--surface", required=True, help="vessel surface mesh (.stl/.glb)")
    ap.add_argument("--aneurysm", help="aneurysm sac mesh (.stl/.glb) — its centroid tags the sac")
    ap.add_argument("--pitch", type=float, default=0.25, help="voxel size mm")
    ap.add_argument("--prune-mm", type=float, default=1.0, help="drop dead-end spurs shorter than this")
    ap.add_argument("--smooth-sigma", type=float, default=0.0, help="gaussian mask smoothing (voxels)")
    ap.add_argument("--merge-mm", type=float, default=1.2, help="collapse junction clusters within this")
    ap.add_argument("--entries", type=int, default=2)
    ap.add_argument("--artifacts", default="artifacts")
    args = ap.parse_args()

    graph_mod = _load("02_graph.py")

    mask, transform = voxelize(args.surface, args.pitch)
    print(f"voxelized {args.surface.split('/')[-1]}: mask {mask.shape} ({int(mask.sum())} vox)")
    pts, radius, polylines = skeleton_polylines(mask, transform, args.pitch, args.prune_mm,
                                                args.smooth_sigma)
    print(f"skeleton: {len(pts)} points, {len(polylines)} branches "
          f"(sigma={args.smooth_sigma}, pruned < {args.prune_mm}mm)")

    aneurysm_pos = None
    if args.aneurysm:
        import trimesh
        aneurysm_pos = trimesh.load(args.aneurysm, force="mesh").centroid
        print(f"aneurysm centroid (mm): {np.round(aneurysm_pos, 2)}")

    graph = graph_mod.build_graph_json(args.case, pts, radius, polylines,
                                       aneurysm_pos=aneurysm_pos, n_entries=args.entries)
    if args.merge_mm > 0:
        graph = merge_close_nodes(graph, args.merge_mm)
    errs = contracts.validate_graph(graph)
    if errs:
        raise SystemExit("graph failed contract:\n  " + "\n  ".join(errs))

    out = os.path.join(args.artifacts, f"case_{args.case}", "graph.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(graph, open(out, "w"), indent=2)
    from collections import Counter
    print(f"wrote {out}: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges, "
          f"types={dict(Counter(n['type'] for n in graph['nodes']))}, "
          f"aneurysm_node={graph['aneurysm_node']}, entries={graph['entry_nodes']}")


if __name__ == "__main__":
    main()
