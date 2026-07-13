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


BLOOD_VISCOSITY_PA_S = 0.0035      # dynamic viscosity of blood
REF_VELOCITY_M_S = 0.30            # representative cerebral-artery mean velocity


def analytic_hemodynamics(graph: dict, mu: float = BLOOD_VISCOSITY_PA_S,
                          v_ref: float = REF_VELOCITY_M_S) -> dict:
    """Tier-3 analytic hemodynamics proxy — NOT a CFD solve (flagged as such).

    Poiseuille wall shear stress per vessel segment: tau = 4*mu*V / r  (narrower vessel => higher
    WSS). The aneurysm sac is a dead-end pouch with recirculation, so it sees LOW wall shear (a
    fraction of the parent) and an elevated oscillatory-shear estimate. Gives non-zero, physically
    grounded numbers without a solver; Tier 1/2 overwrite these with real WSS when available."""
    radii = [e["mean_radius_mm"] for e in graph["edges"] if e.get("mean_radius_mm")]
    radii = [r for r in radii if r and r > 0] or \
            [n["radius"] for n in graph["nodes"] if n.get("radius")]
    wss = [4.0 * mu * v_ref / (r * 1e-3) for r in radii]          # Pa
    peak, mean = max(wss), sum(wss) / len(wss)

    an = next((n for n in graph["nodes"] if n["type"] == "aneurysm"), None)
    parent_r = (an.get("radius") if an else None) or (sum(radii) / len(radii))
    parent_wss = 4.0 * mu * v_ref / (parent_r * 1e-3)
    sac_wss = 0.12 * parent_wss                                   # recirculation ~ 10-15% of parent
    low_thr = 0.4                                                 # common low-shear threshold (Pa)
    lsa = max(0.05, min(0.9, (low_thr - sac_wss) / low_thr)) if sac_wss < low_thr else 0.05
    osi = round(min(0.3, 0.5 * (1 - sac_wss / parent_wss)), 4)    # steady-proxy estimate, flagged
    return {
        "peak_wss_pa": round(peak, 3),
        "mean_wss_pa": round(mean, 3),
        "osi_max": osi,
        "low_shear_area_fraction": round(lsa, 3),
        "_tier": "3-analytic-proxy",
        "_note": "Poiseuille WSS from vessel radii; OSI & low-shear are analytic sac estimates, "
                 "NOT a transient CFD solve. Suggestive, not decisive (WSS<->rupture is contested).",
    }


def _jet(t: np.ndarray) -> np.ndarray:
    """Scalar field in [0,1] -> jet RGBA (blue low -> red high) as uint8."""
    t = np.clip(t, 0, 1)
    r = np.clip(1.5 - np.abs(4 * t - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * t - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * t - 1), 0, 1)
    return (np.column_stack([r, g, b, np.ones_like(t)]) * 255).astype(np.uint8)


def bake_wss_heatmap(case_dir: str) -> tuple:
    """Tier-1 slot (analytic spatial proxy): write a PER-VERTEX WSS field as COLOR_0 on
    aneurysm.glb so the viewer's WSS heatmap has real spatial data instead of a solid color.

    Physiological pattern without a CFD solve: the inflow jet keeps WSS HIGH near the neck, while
    the dome sees recirculation -> LOW WSS (the low-shear region). We scale that gradient to the
    case's peak WSS (real CFD for CMHA; analytic proxy for Aneurisk) and emit wss.json, clearly
    flagged as a proxy. Requires trimesh."""
    import trimesh

    graph = json.load(open(os.path.join(case_dir, "graph.json")))
    morph = json.load(open(os.path.join(case_dir, "morphology.json")))
    peak = float(morph["hemodynamics"].get("peak_wss_pa") or 1.0) or 1.0
    an_id = graph["aneurysm_node"]
    nbrs = [e["source"] if e["target"] == an_id else e["target"]
            for e in graph["edges"] if an_id in (e["source"], e["target"])]
    pos = {n["id"]: np.array(n["pos"], float) for n in graph["nodes"]}
    ref = pos[nbrs[0]] if nbrs else pos[an_id]              # parent vessel node = neck/inflow

    glb = os.path.join(case_dir, "aneurysm.glb")
    mesh = trimesh.load(glb, force="mesh")
    V = np.asarray(mesh.vertices)
    dn = np.linalg.norm(V - ref, axis=1)
    dn = (dn - dn.min()) / (np.ptp(dn) + 1e-9)             # 0 at neck -> 1 at dome
    wss = peak * (0.15 + 0.85 * (1.0 - dn))                # high at neck, ~15% peak at the dome
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=_jet(wss / peak))
    mesh.export(glb)
    json.dump({"case_id": graph["case_id"], "units": "Pa", "peak_wss_pa": round(peak, 3),
               "min_wss_pa": round(float(wss.min()), 3), "n_vertices": int(len(V)),
               "per_vertex_wss_pa": [round(float(w), 4) for w in wss],
               "_tier": "1-analytic-proxy",
               "_note": "Per-vertex WSS is an analytic spatial proxy (high at neck inflow, low at "
                        "dome recirculation) scaled to the case peak WSS — NOT a CFD-solved field."},
              open(os.path.join(case_dir, "wss.json"), "w"), indent=2)
    return wss, peak


def main() -> None:
    ap = argparse.ArgumentParser(description="Phase 3: graph -> streamlines.json (+ baked WSS)")
    ap.add_argument("--case", required=True)
    ap.add_argument("--artifacts", default="artifacts")
    ap.add_argument("--seeds-per-entry", type=int, default=4)
    ap.add_argument("--bake-wss", action="store_true",
                    help="only bake the per-vertex WSS heatmap onto aneurysm.glb (needs morphology.json)")
    args = ap.parse_args()

    case_dir = os.path.join(args.artifacts, f"case_{args.case}")

    if args.bake_wss:
        wss, peak = bake_wss_heatmap(case_dir)
        print(f"baked WSS heatmap on aneurysm.glb: {len(wss)} verts, "
              f"{wss.min():.2f}-{peak:.2f} Pa -> COLOR_0 + wss.json")
        return

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

    # Tier-3 hemodynamics summary so Phase 4 has non-zero WSS/OSI (flagged as a proxy).
    hemo = analytic_hemodynamics(graph)
    hemo_path = os.path.join(case_dir, "hemodynamics.json")
    with open(hemo_path, "w") as f:
        json.dump(hemo, f, indent=2)
    print(f"wrote {hemo_path}: peak_wss={hemo['peak_wss_pa']}Pa mean_wss={hemo['mean_wss_pa']}Pa "
          f"osi={hemo['osi_max']} lsa={hemo['low_shear_area_fraction']} (Tier-3 analytic)")


if __name__ == "__main__":
    main()
