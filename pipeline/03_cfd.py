#!/usr/bin/env python3
"""
PHASE 3 — Hemodynamics / Precomputed CFD (Ronuk).

Goal: get the blood-flow physics — where blood swirls and where it stresses/stagnates against
the wall — computed AHEAD of time so the demo just loads a glowing heatmap + streamlines.

Honesty rule (bakes into the Depth score): the WSS<->rupture link is genuinely contested (both
high and low WSS associate with rupture). Outputs are SUGGESTIVE, NOT DECISIVE — the copilot
must say so.

Three tiers, built bottom-up so something always works:
    Tier 3 — analytic proxy (build FIRST, never fails): seed particles at the inlet, advect
             along the centerline (faster in narrow segments, recirculating in the sac) ->
             streamlines. Zero solver.
    Tier 1 — dataset hemodynamics (real, no solver): map precomputed WSS/OSI from
             Nature-CTA / Aneurisk onto the aneurysm mesh as per-vertex colors.
    Tier 2 — one real CFD run (showpiece): steady-state SimVascular sim for the best hero case.
             Owned solely by Ronuk, in parallel, NEVER on the critical path.

Outputs:
    * streamlines.json (contract schema).
    * WSS baked as per-vertex color (COLOR_0) on aneurysm.glb.
    * scalar summaries (peak/mean WSS, OSI, low-shear fraction) -> merged into morphology.json
      in Phase 4.

Runs in the `neurovas` conda env (numpy, pyvista).
"""

from __future__ import annotations

import argparse
import json
import os

import contracts


# ── Tier 3: analytic streamline proxy (always works) ────────────────────────────────────────
def analytic_streamlines(graph: dict, n_seeds: int = 12) -> list[dict]:
    """Advect particles from entry nodes toward the aneurysm along edge polylines.

    Speed model: inversely proportional to local radius (narrower = faster), with a recirculation
    slow-down inside the aneurysm sac. This is a simplified flow model — label it honestly in the
    demo. Returns a list of {points, speed} matching the streamlines contract.
    """
    import numpy as np

    lines: list[dict] = []
    # TODO: walk entry_node -> aneurysm_node paths over the graph, resample each edge polyline,
    #       assign speed ~ 1/radius, damp inside the sac. For now this is the shape it returns:
    for _ in range(n_seeds):
        pts: list[list[float]] = []   # [[x,y,z], ...] in mm
        spd: list[float] = []         # normalized 0..1 per point
        lines.append({"points": pts, "speed": spd})
    return lines


# ── Tier 1: map dataset WSS/OSI onto the aneurysm mesh ──────────────────────────────────────
def bake_dataset_wss(aneurysm_glb: str, wss_values, out_glb: str) -> dict:
    """Write per-vertex WSS as COLOR_0 on aneurysm.glb (the chosen contract convention) and
    return the scalar summaries for morphology.json."""
    # TODO: load aneurysm.glb, map wss_values -> a low->high color ramp -> COLOR_0, re-export.
    return {
        "peak_wss_pa": float("nan"),
        "mean_wss_pa": float("nan"),
        "osi_max": float("nan"),
        "low_shear_area_fraction": float("nan"),
    }


# ── Tier 2: one genuine SimVascular run (showpiece, off critical path) ───────────────────────
def simvascular_showpiece(*_args, **_kwargs):
    """Steady-state solve for the single best hero case: image/mesh -> boundary conditions ->
    solver -> WSS + velocity field. Configured/run outside this script (SimVascular GUI/CLI);
    this function just documents where its outputs plug in (streamlines + baked WSS)."""
    raise NotImplementedError("Run in SimVascular; import its WSS field + streamlines here.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Phase 3: graph + mesh -> streamlines.json + baked WSS")
    ap.add_argument("--case", required=True)
    ap.add_argument("--tier", type=int, choices=[1, 2, 3], default=3)
    ap.add_argument("--artifacts", default="artifacts")
    args = ap.parse_args()

    case_dir = os.path.join(args.artifacts, f"case_{args.case}")
    graph = json.load(open(os.path.join(case_dir, "graph.json")))

    streamlines = {"case_id": args.case, "streamlines": analytic_streamlines(graph)}
    errs = contracts.validate_streamlines(streamlines)
    if errs:
        raise SystemExit(f"streamlines failed contract: {errs}")
    json.dump(streamlines, open(os.path.join(case_dir, "streamlines.json"), "w"), indent=2)
    print(f"wrote {case_dir}/streamlines.json")

    # TODO (Tier 1/2): bake WSS onto aneurysm.glb and stash the scalar summaries for Phase 4.
    raise SystemExit("Phase 3 skeleton — Tier 3 proxy stubbed; implement advection + WSS bake.")


if __name__ == "__main__":
    main()
