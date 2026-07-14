#!/usr/bin/env python3
"""
Phase 2 QA + catheter routing (Ronuk).

The graph is load-bearing: pathfinding and Claude's reasoning depend on it, so it gets a
hand-verifiable sanity pass and a saved backup for the hero case. This also proves the headline
copilot feature — "how would you get a catheter there?" — is computable on the real graph:
the endovascular route is the shortest path (by segment length) from an entry vessel to the
aneurysm, reconstructed as a drawable 3D polyline the viewer can animate a catheter along.

Usage:
    python pipeline/graph_qa.py --case C0001                 # sanity report + route summary
    python pipeline/graph_qa.py --case C0001 --write-paths   # also emit catheter_paths.json
    python pipeline/graph_qa.py --case C0001 --write-backup  # freeze a hand-verified graph.backup.json
"""

from __future__ import annotations

import argparse
import json
import os
import shutil

import networkx as nx
import numpy as np


def _nx_from_graph(graph: dict) -> nx.Graph:
    g = nx.Graph()
    for n in graph["nodes"]:
        g.add_node(n["id"], pos=np.asarray(n["pos"], float), radius=n.get("radius"), type=n["type"])
    for e in graph["edges"]:
        g.add_edge(e["source"], e["target"], id=e["id"], length_mm=e["length_mm"],
                   mean_radius_mm=e.get("mean_radius_mm"), tortuosity=e.get("tortuosity"),
                   polyline=[np.asarray(p, float) for p in e["polyline"]])
    return g


def sanity_check(graph: dict) -> list[str]:
    """Return a list of problems; empty means the graph is structurally sound."""
    errs: list[str] = []
    g = _nx_from_graph(graph)
    ids = {n["id"] for n in graph["nodes"]}

    if graph["aneurysm_node"] not in ids:
        errs.append(f"aneurysm_node {graph['aneurysm_node']} not among nodes")
    if not graph["entry_nodes"]:
        errs.append("no entry_nodes")
    for e in graph["entry_nodes"]:
        if e not in ids:
            errs.append(f"entry node {e} not among nodes")

    ncc = nx.number_connected_components(g) if g.number_of_nodes() else 0
    if ncc != 1:
        errs.append(f"graph has {ncc} connected components (want 1 — vessels must be one tree)")

    # every entry must actually reach the aneurysm, or catheter routing is impossible
    for e in graph["entry_nodes"]:
        if e in g and graph["aneurysm_node"] in g and not nx.has_path(g, e, graph["aneurysm_node"]):
            errs.append(f"no path from entry {e} to aneurysm {graph['aneurysm_node']}")

    for n in graph["nodes"]:
        if n.get("radius") is not None and n["radius"] <= 0:
            errs.append(f"node {n['id']} has non-positive radius {n['radius']}")
    for e in graph["edges"]:
        if e["length_mm"] <= 0:
            errs.append(f"edge {e['id']} has non-positive length {e['length_mm']}")
        if e.get("tortuosity") is not None and e["tortuosity"] < 0.999:
            errs.append(f"edge {e['id']} tortuosity {e['tortuosity']} < 1 (impossible)")
        if len(e["polyline"]) < 2:
            errs.append(f"edge {e['id']} polyline has < 2 points")
    return errs


def catheter_routes(graph: dict) -> list[dict]:
    """Shortest endovascular route from each entry to the aneurysm, as a drawable 3D polyline."""
    g = _nx_from_graph(graph)
    target = graph["aneurysm_node"]
    routes = []
    for entry in graph["entry_nodes"]:
        if entry not in g or target not in g or not nx.has_path(g, entry, target):
            continue
        node_path = nx.shortest_path(g, entry, target, weight="length_mm")
        pts: list[list[float]] = []
        for a, b in zip(node_path[:-1], node_path[1:]):
            poly = list(g[a][b]["polyline"])
            # orient each segment's polyline to continue from node a's position
            if np.linalg.norm(poly[0] - g.nodes[a]["pos"]) > np.linalg.norm(poly[-1] - g.nodes[a]["pos"]):
                poly = poly[::-1]
            if pts and np.allclose(pts[-1], poly[0]):
                poly = poly[1:]
            pts.extend(p.tolist() for p in poly)
        length = float(sum(g[a][b]["length_mm"] for a, b in zip(node_path[:-1], node_path[1:])))
        routes.append({"entry_node": entry, "target_node": target, "node_path": node_path,
                       "n_hops": len(node_path) - 1, "length_mm": round(length, 2),
                       "route_points": [[round(c, 4) for c in p] for p in pts]})
    return routes


def main() -> None:
    ap = argparse.ArgumentParser(description="Phase 2 QA + catheter routing")
    ap.add_argument("--case", required=True)
    ap.add_argument("--artifacts", default="artifacts")
    ap.add_argument("--write-paths", action="store_true", help="emit catheter_paths.json sidecar")
    ap.add_argument("--write-backup", action="store_true", help="freeze graph.backup.json")
    args = ap.parse_args()

    case_dir = os.path.join(args.artifacts, f"case_{args.case}")
    graph_path = os.path.join(case_dir, "graph.json")
    graph = json.load(open(graph_path))

    print(f"== graph QA: {graph_path} ==")
    errs = sanity_check(graph)
    if errs:
        print("SANITY: FAIL")
        for e in errs:
            print("  ·", e)
    else:
        print(f"SANITY: PASS ({len(graph['nodes'])} nodes, {len(graph['edges'])} edges, "
              f"aneurysm={graph['aneurysm_node']}, entries={graph['entry_nodes']})")

    routes = catheter_routes(graph)
    print(f"\n== catheter routes to the aneurysm: {len(routes)} ==")
    for r in routes:
        print(f"  entry {r['entry_node']} -> aneurysm {r['target_node']}: "
              f"{r['n_hops']} hops, {r['length_mm']} mm, {len(r['route_points'])} route points")

    if args.write_paths:
        out = os.path.join(case_dir, "catheter_paths.json")
        json.dump({"case_id": graph["case_id"], "units": "mm", "routes": routes},
                  open(out, "w"), indent=2)
        print(f"\nwrote {out}")
    if args.write_backup:
        bak = os.path.join(case_dir, "graph.backup.json")
        shutil.copyfile(graph_path, bak)
        print(f"froze {bak}")

    raise SystemExit(1 if errs else 0)


if __name__ == "__main__":
    main()
