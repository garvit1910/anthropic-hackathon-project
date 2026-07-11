#!/usr/bin/env python3
"""
PHASE 3 — Hemodynamics / Precomputed CFD (Ronuk).

Compute the blood-flow visuals AHEAD of time so the demo just loads streamlines + a WSS heatmap.

Honesty rule (Depth score): the WSS<->rupture link is genuinely contested (both high and low WSS
associate with rupture). Outputs are SUGGESTIVE, NOT DECISIVE — the copilot must say so.

Three tiers, bottom-up so something always works:
    Tier 3 — analytic proxy (IMPLEMENTED here, never fails): advect particles from each entry
             node to the aneurysm along the graph, speed ~ 1/radius (narrower = faster), damped
             inside the sac. Pure geometry, zero solver.
    Tier 1 — dataset WSS/OSI mapped onto aneurysm.glb as per-vertex COLOR_0 (real, no solver).
    Tier 2 — one SimVascular steady-state run as the showpiece (off the critical path).

Output: streamlines.json (contract). Tier 1/2 additionally bake WSS + emit scalar summaries for
Phase 4.

Usage:
    python pipeline/03_cfd.py --case C0035 --artifacts artifacts
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


def _graph_from_contract(graph: dict) -> nx.Graph:
    g = nx.Graph()
    for n in graph["nodes"]:
        g.add_node(n["id"], pos=np.array(n["pos"], dtype=float), radius=n["radius"], type=n["type"])
    for e in graph["edges"]:
        g.add_edge(e["source"], e["target"], polyline=np.array(e["polyline"], dtype=float),
                   length_mm=e["length_mm"], mean_radius_mm=e["mean_radius_mm"])
    return g


def _edge_polyline_directed(g: nx.Graph, u: int, v: int) -> np.ndarray:
    """Return the edge's polyline oriented so it starts at u and ends at v."""
    poly = g[u][v]["polyline"]
    if np.linalg.norm(poly[0] - g.nodes[u]["pos"]) > np.linalg.norm(poly[-1] - g.nodes[u]["pos"]):
        poly = poly[::-1]
    return poly


def _resample(points: np.ndarray, n: int) -> np.ndarray:
    """Arc-length resample a polyline to n evenly spaced points."""
    if len(points) < 2:
        return np.repeat(points, n, axis=0)[:n]
    seg = np.linalg.norm(np.diff(points, axis=0), axis=1)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    if s[-1] == 0:
        return np.repeat(points[:1], n, axis=0)
    targets = np.linspace(0, s[-1], n)
    return np.column_stack([np.interp(targets, s, points[:, k]) for k in range(3)])


def analytic_streamlines(graph: dict, seeds_per_entry: int = 4, n_pts: int = 60,
                         jitter_mm: float = 0.3) -> list[dict]:
    """Advect particles entry -> aneurysm along the shortest graph path; speed ~ 1/radius, damped
    in the sac. Returns a list of {points, speed} matching the streamlines contract."""
    g = _graph_from_contract(graph)
    aneurysm = graph["aneurysm_node"]
    entries = graph["entry_nodes"] or [n["id"] for n in graph["nodes"] if n["type"] == "endpoint"]

    rng = np.random.default_rng(1234)  # deterministic across runs
    lines: list[dict] = []
    for entry in entries:
        try:
            node_path = nx.shortest_path(g, entry, aneurysm, weight="length_mm")
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            continue

        # concatenate directed edge polylines + per-vertex radius along the path
        pts_parts, rad_parts = [], []
        for u, v in zip(node_path[:-1], node_path[1:]):
            poly = _edge_polyline_directed(g, u, v)
            r = g[u][v]["mean_radius_mm"]
            pts_parts.append(poly if not pts_parts else poly[1:])
            rad_parts.append(np.full(len(poly) if len(pts_parts) == 1 else len(poly) - 1, r))
        if not pts_parts:
            continue
        centerline = np.vstack(pts_parts)
        radii = np.concatenate(rad_parts)

        base = _resample(centerline, n_pts)
        base_r = np.interp(np.linspace(0, 1, n_pts), np.linspace(0, 1, len(radii)), radii)
        base_r = np.clip(base_r, 1e-3, None)

        # speed ~ 1/radius, normalized; damp the last 15% (recirculation in the sac)
        speed = 1.0 / base_r
        speed = speed / speed.max()
        damp = np.ones(n_pts)
        tail = max(1, int(0.15 * n_pts))
        damp[-tail:] = np.linspace(1.0, 0.25, tail)
        speed = np.clip(speed * damp, 0.02, 1.0)

        for _ in range(seeds_per_entry):
            offset = rng.normal(0, jitter_mm, size=(1, 3))
            pts = base + offset
            lines.append({
                "points": [[round(float(c), 4) for c in p] for p in pts],
                "speed": [round(float(s), 4) for s in speed],
            })
    return lines


# ── Tier 1 / Tier 2 (need the aneurysm mesh + dataset WSS; wired in the conda env) ──────────
def bake_dataset_wss(aneurysm_glb: str, wss_values, out_glb: str) -> dict:
    """Write per-vertex WSS as COLOR_0 on aneurysm.glb (chosen contract convention) and return
    the scalar summaries for morphology.json. Requires trimesh (conda env)."""
    raise NotImplementedError("Tier 1: map dataset WSS -> COLOR_0 on aneurysm.glb")


def main() -> None:
    ap = argparse.ArgumentParser(description="Phase 3: graph -> streamlines.json (+ baked WSS)")
    ap.add_argument("--case", required=True)
    ap.add_argument("--artifacts", default="artifacts")
    ap.add_argument("--seeds-per-entry", type=int, default=4)
    args = ap.parse_args()

    case_dir = os.path.join(args.artifacts, f"case_{args.case}")
    with open(os.path.join(case_dir, "graph.json")) as f:
        graph = json.load(f)

    streamlines = {
        "case_id": args.case,
        "streamlines": analytic_streamlines(graph, seeds_per_entry=args.seeds_per_entry),
    }
    errs = contracts.validate_streamlines(streamlines)
    if errs:
        raise SystemExit("streamlines failed contract:\n  " + "\n  ".join(errs))

    out_path = os.path.join(case_dir, "streamlines.json")
    with open(out_path, "w") as f:
        json.dump(streamlines, f, indent=2)
    print(f"wrote {out_path}: {len(streamlines['streamlines'])} streamlines (Tier 3 proxy)")


if __name__ == "__main__":
    main()
