#!/usr/bin/env python3
"""
PHASE 2 — Graph Abstraction (Ronuk) ★ THE CRITICAL UNLOCK.

Turn the vessel centerline into a MAP: junctions = nodes, vessel segments = edges. Once the
vasculature is a graph, catheter routing is route-finding and Claude can "read" the anatomy.
Everything downstream (pathfinding, reasoning) depends on this file.

Pipeline:
    centerline points+radius+branches
      -> merge coincident points (Aneurisk branches share geometry)
      -> fine graph (consecutive points per branch)
      -> reduce: contract degree-2 chains into edges between junction/endpoint nodes
      -> tag aneurysm node + entry (inlet) nodes
      -> graph.json (contract schema)

Inputs:  a centerline .vtp (Aneurisk provides one — no VMTK needed) OR points+radius+branches.
Output:  graph.json.

Heavy deps (numpy/scipy/networkx) are imported at module top; pyvista is imported lazily inside
the reader so the graph algorithms are testable without a mesh library.

Usage:
    python pipeline/02_graph.py --case C0035 --centerline path/to/centerline.vtp --out artifacts
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys

import networkx as nx
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import contracts  # noqa: E402


# ── point merging (union-find over near-coincident points) ──────────────────────────────────
def merge_points(pts: np.ndarray, radius: np.ndarray | None, tol: float = 0.01):
    """Weld points within `tol` mm into shared nodes. Returns (pos Mx3, radius M, orig->merged).

    `tol` MUST stay below the centerline's point spacing, or union-find chains consecutive points
    along one line into a blob and the graph collapses. It exists only to fuse the duplicate
    trunk points that overlapping vmtk centerlines share. build_graph_json sets it adaptively.
    """
    from scipy.spatial import cKDTree

    n = len(pts)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    if n:
        tree = cKDTree(pts)
        for a, b in tree.query_pairs(r=tol):
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

    roots: dict[int, int] = {}
    orig2merged = np.empty(n, dtype=int)
    for i in range(n):
        r = find(i)
        orig2merged[i] = roots.setdefault(r, len(roots))

    m = len(roots)
    pos = np.zeros((m, 3))
    rad = np.zeros(m)
    counts = np.zeros(m)
    for i in range(n):
        mi = orig2merged[i]
        pos[mi] += pts[i]
        counts[mi] += 1
        if radius is not None:
            rad[mi] += radius[i]
    pos /= counts[:, None]
    rad = rad / counts if radius is not None else np.full(m, np.nan)
    return pos, rad, orig2merged


def build_fine_graph(polylines: list[list[int]], orig2merged: np.ndarray) -> nx.Graph:
    """Fine graph: an edge between every pair of consecutive points along each branch."""
    g = nx.Graph()
    for pl in polylines:
        for i in range(len(pl) - 1):
            a, b = int(orig2merged[pl[i]]), int(orig2merged[pl[i + 1]])
            if a != b:
                g.add_edge(a, b)
    return g


# ── reduction: contract degree-2 chains into segment edges ──────────────────────────────────
def reduce_graph(gf: nx.Graph, pos: np.ndarray, rad: np.ndarray) -> nx.Graph:
    """Junctions = nodes with degree != 2. Contract the degree-2 chains between them into edges
    carrying polyline / length_mm / mean_radius_mm / tortuosity."""
    branch = {n for n in gf.nodes if gf.degree(n) != 2}
    gr = nx.Graph()
    for b in branch:
        gr.add_node(b, pos=pos[b].tolist(), radius=float(rad[b]))

    walked: set[tuple[int, int]] = set()
    for b in branch:
        for nb in gf.neighbors(b):
            if (b, nb) in walked:
                continue
            chain = [b, nb]
            prev, cur = b, nb
            walked.add((b, nb))
            while gf.degree(cur) == 2 and cur not in branch:
                nxt = [x for x in gf.neighbors(cur) if x != prev]
                if not nxt:
                    break
                prev, cur = cur, nxt[0]
                chain.append(cur)
            walked.add((cur, prev))
            if cur == b:
                continue  # degenerate self-loop
            poly = np.array([pos[c] for c in chain])
            seglens = np.linalg.norm(np.diff(poly, axis=0), axis=1)
            length = float(seglens.sum())
            straight = float(np.linalg.norm(poly[-1] - poly[0]))
            tort = max(length / straight, 1.0) if straight > 1e-6 else 1.0
            radii = [rad[c] for c in chain if not math.isnan(rad[c])]
            mean_r = float(np.mean(radii)) if radii else float("nan")
            if not gr.has_edge(b, cur):
                gr.add_edge(b, cur, polyline=poly.tolist(), length_mm=length,
                            mean_radius_mm=mean_r, tortuosity=tort)
    return gr


# ── tagging ─────────────────────────────────────────────────────────────────────────────────
def tag_nodes(gr: nx.Graph, aneurysm_pos=None, n_entries: int = 1):
    """Assign node types. Endpoints (deg 1) with the largest radius become entries (proximal
    vessels are wider — a heuristic; override with --entry-nodes). The aneurysm node is the graph
    node nearest the aneurysm centroid, or (fallback) the node with the largest inscribed radius,
    since the sac carries a large inscribed sphere."""
    for n in gr.nodes:
        gr.nodes[n]["type"] = "endpoint" if gr.degree(n) == 1 else "bifurcation"

    # Tag the aneurysm FIRST so a large-radius sac endpoint can't be mistaken for an inlet.
    if aneurysm_pos is not None:
        ap = np.asarray(aneurysm_pos, dtype=float)
        anode = min(gr.nodes, key=lambda n: float(np.linalg.norm(np.array(gr.nodes[n]["pos"]) - ap)))
    else:
        anode = max(gr.nodes, key=lambda n: gr.nodes[n].get("radius") or 0.0)
    gr.nodes[anode]["type"] = "aneurysm"

    # Entries: the widest endpoints (proximal vessels are wider), excluding the aneurysm node.
    endpoints = [n for n in gr.nodes if gr.degree(n) == 1 and n != anode]
    endpoints.sort(key=lambda n: gr.nodes[n].get("radius") or 0.0, reverse=True)
    entry_nodes = endpoints[: max(1, n_entries)]
    for e in entry_nodes:
        gr.nodes[e]["type"] = "entry"
    return anode, entry_nodes


# ── serialize ───────────────────────────────────────────────────────────────────────────────
def _num(x, fallback=0.0, nd=4):
    v = float(x)
    return round(fallback if math.isnan(v) else v, nd)


def to_contract(case_id: str, gr: nx.Graph, aneurysm_node, entry_nodes) -> dict:
    ids = sorted(gr.nodes)
    remap = {old: i for i, old in enumerate(ids)}
    nodes = [{
        "id": remap[n],
        "pos": [round(float(c), 4) for c in gr.nodes[n]["pos"]],
        "type": gr.nodes[n]["type"],
        "radius": _num(gr.nodes[n].get("radius"), fallback=0.5),
    } for n in ids]
    edges = [{
        "id": i,
        "source": remap[u],
        "target": remap[v],
        "length_mm": _num(d["length_mm"]),
        "mean_radius_mm": _num(d["mean_radius_mm"], fallback=0.5),
        "tortuosity": _num(d["tortuosity"], fallback=1.0),
        "polyline": [[round(float(c), 4) for c in p] for p in d["polyline"]],
    } for i, (u, v, d) in enumerate(gr.edges(data=True))]
    return {
        "case_id": case_id,
        "units": contracts.UNITS,
        "nodes": nodes,
        "edges": edges,
        "aneurysm_node": remap[aneurysm_node],
        "entry_nodes": [remap[e] for e in entry_nodes],
    }


def build_graph_json(case_id, pts, radius, polylines, aneurysm_pos=None,
                     n_entries=1, merge_tol=0.01) -> dict:
    """End-to-end: raw centerline arrays -> contract-shaped graph dict.

    merge_tol is treated as a CAP: the effective weld tolerance is clamped to 30% of the finest
    intra-line point spacing, so densely-sampled centerlines never self-collapse.
    """
    pts = np.asarray(pts, dtype=float)
    seg = [np.linalg.norm(np.diff(pts[pl], axis=0), axis=1) for pl in polylines if len(pl) > 1]
    min_spacing = float(np.concatenate(seg).min()) if seg else merge_tol
    weld = min(merge_tol, 0.3 * min_spacing)
    pos, rad, o2m = merge_points(pts,
                                 None if radius is None else np.asarray(radius, dtype=float),
                                 tol=weld)
    gf = build_fine_graph(polylines, o2m)
    gr = reduce_graph(gf, pos, rad)
    if gr.number_of_nodes() == 0:
        raise SystemExit("graph reduced to zero nodes — check centerline connectivity / merge_tol")
    anode, entries = tag_nodes(gr, aneurysm_pos=aneurysm_pos, n_entries=n_entries)
    return to_contract(case_id, gr, anode, entries)


def main() -> None:
    ap = argparse.ArgumentParser(description="Phase 2: centerline -> graph.json")
    ap.add_argument("--case", required=True)
    ap.add_argument("--centerline", help="centerline .vtp (Aneurisk). Omit to auto-discover in --case-dir")
    ap.add_argument("--case-dir", help="folder to auto-discover the centerline in")
    ap.add_argument("--aneurysm-pos", type=float, nargs=3, help="x y z of aneurysm centroid (mm)")
    ap.add_argument("--entries", type=int, default=1, help="how many inlet endpoints to tag as entry")
    ap.add_argument("--merge-tol", type=float, default=0.01,
                    help="cap on the point-weld tolerance in mm (auto-clamped below the sampling)")
    ap.add_argument("--out", default="artifacts")
    args = ap.parse_args()

    from _common import discover_case_files, read_centerline

    cl_path = args.centerline
    if not cl_path and args.case_dir:
        cl_path = discover_case_files(args.case_dir)["centerline"]
    if not cl_path:
        raise SystemExit("no centerline given/found (use --centerline or --case-dir)")

    pts, radius, polylines, _ = read_centerline(cl_path)
    graph = build_graph_json(args.case, pts, radius, polylines,
                             aneurysm_pos=args.aneurysm_pos, n_entries=args.entries,
                             merge_tol=args.merge_tol)
    errs = contracts.validate_graph(graph)
    if errs:
        raise SystemExit("graph failed contract:\n  " + "\n  ".join(errs))

    out_dir = os.path.join(args.out, f"case_{args.case}")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "graph.json")
    with open(out_path, "w") as f:
        json.dump(graph, f, indent=2)
    print(f"wrote {out_path}: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges, "
          f"aneurysm_node={graph['aneurysm_node']}, entries={graph['entry_nodes']}")


if __name__ == "__main__":
    main()
