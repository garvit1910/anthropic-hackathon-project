#!/usr/bin/env python3
"""
PHASE 2 — Graph Abstraction (Ronuk) ★ THE CRITICAL UNLOCK.

Goal: turn the vessel shell into a MAP — junctions = nodes, vessel segments = edges — so a
catheter route becomes route-finding and Claude can "read" the anatomy. Everything downstream
(pathfinding, reasoning) depends on this file.

Inputs:  vessel mesh (+ for Aneurisk, the provided centerline .vtp).
Output:  graph.json (contract schema, node 3D coords in mm so the viewer can draw paths).

Insurance (do now, not later): hand-verify the graph for the primary hero case. If automated
centerline extraction adds spurious hair-like branches, keep a hand-cleaned graph.json for that
one case as the demo guarantee.

Handoff -> Garvit: find_catheter_path runs A* over this file; the viewer draws paths from the
edge polylines.

Runs in the `neurovas` conda env (vmtk, networkx, numpy).
"""

from __future__ import annotations

import argparse
import json
import os

import contracts


# ── Centerline ──────────────────────────────────────────────────────────────────────────────
def get_centerline(vessel_mesh_path: str, provided_centerline: str | None):
    """Return centerline points + per-point radius as arrays.

    Aneurisk ships a centerline .vtp -> parse it (saves time). Otherwise run VMTK
    (vmtkcenterlines) or 3D Slicer's Extract Centerline (5-20s, robust). The per-point radius
    is the vessel caliber along each segment — keep it, it becomes mean_radius_mm per edge.
    """
    if provided_centerline:
        import pyvista as pv

        cl = pv.read(provided_centerline)
        points = cl.points                                  # (N, 3) in mm
        radius = cl.point_data.get("MaximumInscribedSphereRadius")  # Aneurisk field name
        return points, radius
    raise NotImplementedError("TODO: run vmtkcenterlines / Slicer Extract Centerline")


# ── Graph build ─────────────────────────────────────────────────────────────────────────────
def build_graph(points, radius, aneurysm_centroid, entry_hint):
    """Build a networkx graph: nodes = bifurcations + endpoints, edges = segments between them.

    Per edge compute length_mm, mean_radius_mm, and tortuosity (path length / straight-line
    distance, >= 1). Tag the aneurysm node (centerline node nearest the aneurysm mesh centroid)
    and the entry nodes (ICA / vertebral inlets).
    """
    import networkx as nx

    g = nx.Graph()
    # TODO: detect bifurcations/endpoints, add nodes with pos+radius+type, add edges with
    #       length_mm/mean_radius_mm/tortuosity/polyline.
    return g


def tortuosity(polyline) -> float:
    """Path length / straight-line distance between endpoints (>= 1; higher = twistier)."""
    import numpy as np

    pts = np.asarray(polyline, dtype=float)
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1).sum()
    straight = np.linalg.norm(pts[-1] - pts[0])
    return float(seg / straight) if straight > 0 else 1.0


# ── Serialize ───────────────────────────────────────────────────────────────────────────────
def to_contract(case_id: str, g) -> dict:
    """Serialize the networkx graph into the graph.json contract shape."""
    nodes = [{"id": nid, "pos": list(d["pos"]), "type": d["type"], "radius": d["radius"]}
             for nid, d in g.nodes(data=True)]
    edges = [{"id": i, "source": u, "target": v, "length_mm": d["length_mm"],
              "mean_radius_mm": d["mean_radius_mm"], "tortuosity": d["tortuosity"],
              "polyline": d["polyline"]}
             for i, (u, v, d) in enumerate(g.edges(data=True))]
    return {
        "case_id": case_id,
        "units": contracts.UNITS,
        "nodes": nodes,
        "edges": edges,
        "aneurysm_node": next((n["id"] for n in nodes if n["type"] == "aneurysm"), None),
        "entry_nodes": [n["id"] for n in nodes if n["type"] == "entry"],
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Phase 2: vessel mesh -> graph.json")
    ap.add_argument("--case", required=True)
    ap.add_argument("--vessel-mesh", required=True)
    ap.add_argument("--centerline", help="provided centerline .vtp (Aneurisk)")
    ap.add_argument("--out", default="artifacts")
    args = ap.parse_args()

    out_dir = os.path.join(args.out, f"case_{args.case}")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "graph.json")

    # points, radius = get_centerline(args.vessel_mesh, args.centerline)
    # g = build_graph(points, radius, aneurysm_centroid=..., entry_hint=...)
    # graph = to_contract(args.case, g)
    # errs = contracts.validate_graph(graph)
    # assert not errs, errs
    # json.dump(graph, open(out_path, "w"), indent=2)
    raise SystemExit("Phase 2 skeleton — implement centerline + graph build, validate, then write graph.json.")


if __name__ == "__main__":
    main()
