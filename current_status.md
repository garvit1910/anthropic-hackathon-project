# NeuroVas Copilot — Current Build Status

> **What this document is.** A complete, honest snapshot of *what the build actually is right now* —
> the datasets, the offline pipeline, the artifacts, the Claude agent, the RAG corpus, how the
> catheter route is found, and what the 3D viewer does. It is written to be self-contained: a fresh
> reader (or Claude on the web) can absorb the whole system from this one file. For feature ideas and
> the tumor/oncology question, see the companion **[`IDEAS.md`](IDEAS.md)**.
>
> _Note: `CLAUDE.md` describes an aspirational Python `app/agent/` layout. The real agent shipped as
> TypeScript in `lib/agent/`. Where this document and `CLAUDE.md` disagree, **this document reflects
> the code on disk.**_

---

## 1. What NeuroVas Copilot is

An **interrogable 3D aneurysm copilot**. One patient, one aneurysm, one conversation: a clinician
asks *"will this rupture, why, what if it were bigger, and how would you get a catheter there?"* and
Claude reasons over the patient's real vessel geometry, blood-flow physics, and the medical
literature — **showing its work on the 3D model the whole time**. The pitch is decision *support*,
not a verdict: the copilot is explicitly built to hedge, cite, and surface the contested science
rather than pretend to certainty.

The product is a **Next.js 14 web app** with three parts:
- an **offline Python pipeline** that turns public neuro-imaging datasets into baked per-case artifacts;
- a **TypeScript Claude agent** (5 tools + RAG) exposed over a streaming API route;
- a **Three.js 3D viewer** (in an iframe) that the agent drives live as it reasons.

---

## 2. The demo in ~60 seconds

1. The clinician opens the **console** (`/console`) — a split screen: a live 3D vessel model on the
   left, a streaming copilot on the right. A case is loaded (e.g. `HERO_sub013`, `C0001`, `CMHA_…`).
2. They ask a question in plain language ("Is this likely to rupture, and why?").
3. The agent streams its **extended-thinking reasoning** token-by-token, then calls tools:
   `get_morphology` (reads the patient's numbers), `query_literature` (pulls cited evidence),
   `find_catheter_path` / `perturb_morphology` as the question demands.
4. **The 3D shows the work in sync:** the camera frames the aneurysm, the wall-shear-stress heatmap
   and pulsatile blood flow switch on, and — for an access question — an animated pathfinding search
   sweeps the vessel tree and reveals a gold catheter route.
5. The copilot returns a **hedged risk assessment**: a short headline, grounded reasoning steps (each
   tied to both a patient value *and* a literature source), a confidence level, "what would change my
   mind," and citations. It never states the known outcome.

---

## 3. Architecture at a glance

```
 PUBLIC DATASETS            OFFLINE PYTHON PIPELINE            BAKED ARTIFACTS            LIVE APP (Next.js)
 (not committed)            (pipeline/, runs once)             (artifacts/case_*/)        ─────────────────
 ┌─────────────┐           ┌──────────────────────┐          ┌───────────────────┐      ┌──────────────────────┐
 │ Aneurisk    │           │ 01 geometry  (mesh/  │          │ vessel_tree.glb   │      │ TS Claude agent      │
 │ AneuX       │──download─▶│    TOF→3D recon)     │──bake──▶ │ aneurysm.glb      │─────▶│ lib/agent/ (5 tools) │
 │ CMHA        │           │ 02 graph     (center │          │ graph.json        │      │  + RAG (42 chunks)   │
 │ Lausanne    │           │    line→networkx)    │          │ streamlines.json  │      │        │             │
 │ TOF-MRA     │           │ 03 cfd  (analytic    │          │ wss.json          │      │  POST /api/agent     │
 └─────────────┘           │    proxy WSS/flow)   │          │ hemodynamics.json │      │  (SSE streaming)     │
                           │ 04 morphology (sizes)│          │ morphology.json   │      │        │             │
                           │ + aneurysm_detect,   │          │ catheter_paths.json│     └────────┼─────────────┘
                           │   graph_qa (routes)  │          └───────────────────┘               │ postMessage
                           └──────────────────────┘                                     ┌────────▼─────────────┐
                                                                                        │ Three.js viewer      │
  CORE PRINCIPLE: every heavy computation runs ONCE, offline, and is baked into static  │ public/viewer.html   │
  files. The live demo only loads those files and reasons over them — instant, GPU-free.│ (iframe, agent-driven)│
                                                                                        └──────────────────────┘
```

**Two builders, one contract.** `contracts.py` (+ `validate_artifacts.py`) is the agreed schema for
every handoff file, so the pipeline and the app were built in parallel against the same shapes.

---

## 4. The datasets & what we do with each

**No raw datasets are committed to the repo** (they are `.gitignore`d and can be multi-GB). Only the
*derived artifacts* for a few cases are checked in. The datasets referenced:

| Dataset | What it gives us | What we do with it |
|---|---|---|
| **Aneurisk** (GitHub mirror) | Vessel surface meshes **with centerlines already computed** | The hero geometry + graph case (`C0001`): parse the provided centerline → graph; detect the sac; measure it. |
| **AneuX** (Zenodo 6678442) | 750 domes + 668 vessel trees + 170 morphometric indices + rupture status | Fast path to clean geometry + a cohort for morphology/atlas (currently referenced, artifacts baked for the hero cases). |
| **CMHA** (Song et al., *Sci Data* 2024) | **Real dataset-computed CFD hemodynamics** (WSS/OSI), morphometry, clinical, and published PHASES/ELAPSS scores for ~105 aneurysms | The one case (`CMHA_AHMU1218001`) whose hemodynamics are *real*, not a proxy — our honest "real physics" showcase. |
| **Lausanne TOF-MRA** (OpenNeuro ds003949) | Open TOF-MRA scans + manual aneurysm labels | The **reconstruction showcase** (`HERO_sub013`): we rebuild the 3D vessel tree from raw scan slices + a real aneurysm mask. |

---

## 5. The offline pipeline (Phases 1–4)

Everything here runs **once, before the demo**, and writes static files. Env: numpy, scipy, networkx,
pandas, trimesh, pyvista, nibabel, scikit-image (+ vmtk/vtk/pygltflib in the full conda env). There is
**no CFD solver anywhere** — a grep for `simvascular|openfoam|navier|solve` finds only docstrings.

| Phase | File | Input | **What we COMPUTE** | **What we COPY from the dataset** | Output |
|---|---|---|---|---|---|
| **1 — Geometry** | `pipeline/01_geometry.py` | vessel surface `.vtp`/`.stl`, or a TOF-MRA `.nii` volume | Mesh cleaning (largest component, hole-fill, Taubin smooth) + GLB export. For the `.nii` path: **a real 2D-slices → 3D reconstruction** — intensity/Frangi vesselness → `marching_cubes` → voxel→mm via the affine → surface. | The raw surface geometry itself. | `vessel_tree.glb`, `aneurysm.glb` |
| **2 — Graph ★** | `pipeline/02_graph.py`, `skeleton_graph.py` | a centerline `.vtp` (Aneurisk ships one), or a mesh | The **graph abstraction**: weld near-duplicate points → build fine graph → contract degree-2 chains into edges carrying computed `length_mm`, `mean_radius_mm`, and `tortuosity` (arc/chord ≥ 1); tag node types + entry/aneurysm nodes. For mesh-only datasets, `skeleton_graph.py` **computes a centerline** (voxelize → `skeletonize` → distance-transform radii). | The centerline polyline itself, when the dataset provides one (parsed, not derived). | `graph.json` |
| **3 — CFD (proxy)** | `pipeline/03_cfd.py` | `graph.json` (+ `aneurysm.glb`) | **A Tier-3 analytic proxy — pure geometry, zero solver.** Streamlines are *synthesized* by advecting particles along graph shortest-paths (speed ∝ 1/radius, damped in the sac). WSS/OSI are analytic Poiseuille (`wss = 4·μ·v/r`). A neon per-vertex WSS heatmap is baked to `aneurysm.glb`'s `COLOR_0`. Every output is flagged `"_tier":"3-analytic-proxy"` / `"NOT a CFD solve"`. | (Nothing — this phase is entirely computed, but it is a *proxy*, not simulated physics.) | `streamlines.json`, `hemodynamics.json`, `wss.json` |
| **4 — Morphology** | `pipeline/04_morphology.py` | the sac mesh + a dataset CSV | **The size metrics** from the sac mesh: neck-plane fit (SVD over the open boundary loop) → height, neck width, max diameter, aspect ratio, size ratio. | The **clinical** block (age / sex / rupture status / location) from the dataset CSV; for CMHA, the **real WSS/OSI/morphometry** too. | `morphology.json` |

**Supporting scripts:** `aneurysm_detect.py` is the *real* sac detector (centerline-deviation: surface
bulges where distance-to-centerline exceeds the local radius) — this, not Phase-1's placeholder
sphere-clip, is what actually isolated `C0001`'s sac. `graph_qa.py` sanity-checks the graph and
computes the **catheter routes** (shortest path from each entry to the aneurysm) → `catheter_paths.json`.
`build_hero.py` orchestrates the full TOF-MRA → interrogable-model reconstruction for `HERO_sub013`.

**Honest caveat baked into the code:** the Phase-1 sphere-clip aneurysm isolation is a placeholder
(superseded by `aneurysm_detect.py`), and Tier-1/Tier-2 CFD (a real SimVascular run) is described in
docstrings but **never executed**. Hemodynamics is a labeled proxy for every case except CMHA.

---

## 6. The artifacts (the handoff)

Each case is a folder `artifacts/case_<ID>/` (viewer-served copies live under `public/artifacts/`).
The interface contract (`contracts.py`) fixes: **millimetres**, **Y-up**, **one shared world frame**
(so `vessel_tree.glb`, `aneurysm.glb`, and `graph.json` overlay exactly), and validates the 5-file
handoff with physical-range guards (e.g. OSI ∈ [0, 0.5]).

**Files per case:** `vessel_tree.glb`, `aneurysm.glb` (+ `brain.glb` for HERO), `graph.json`
(nodes with `pos`/`type`/`radius`, edges with `length_mm`/`mean_radius_mm`/`tortuosity`/`polyline`,
plus `aneurysm_node` + `entry_nodes`), `streamlines.json`, `wss.json`, `hemodynamics.json`,
`morphology.json` (geometry / hemodynamics / clinical), and `catheter_paths.json`.

**Validation status (`python validate_artifacts.py artifacts`):**

| Case | Provenance | Passes contract? |
|---|---|---|
| `case_C0001` | Aneurisk surface + centerline → real pipeline | ✅ **Real geometry** (flow/WSS = proxy) |
| `case_CMHA_AHMU1218001` | CMHA meshes + **real dataset CFD** | ✅ **Real geometry + real hemodynamics** |
| `case_HERO_sub013` | Lausanne TOF-MRA reconstructed + real aneurysm mask | ✅ **Real reconstruction** (flow/WSS = proxy) |
| `case_ANEURISK_C0034`, `case_ANEUX_042`, `case_CTA_2024_017`, `case_LAUSANNE_ds003949_08` | JS-synthesized viewer fixtures | ❌ fail (illegal node types `inlet`/`terminal`, missing GLBs, stripped clinical) |
| `case_LAUSANNE_sub000` | partial (lone `vessel_tree.glb`) | ❌ fail (incomplete) |

So: **3 real, contract-passing cases; 5 that don't pass** (4 lightweight synthetic fixtures the viewer
can display, + 1 partial). The synthetic ones exist so the frontend had something to render before the
real pipeline landed — they are not part of the "real" story.

---

## 7. The Claude agent

- **Where:** `lib/agent/` (TypeScript), exposed as a Next.js route `POST /api/agent` (`app/api/agent/route.ts`).
- **Transport:** **Server-Sent Events.** The route streams `thinking`, `text`, `tool_call`,
  `tool_result`, then a terminal `answer` / `risk` / `sources` / `done`. It pads the stream to defeat
  browser buffering, heartbeats every 15 s, and aborts the model run if the client disconnects.
- **Model:** `claude-opus-4-8` (overridable via `ANTHROPIC_MODEL`), with **adaptive, summarized
  extended thinking** and high effort. The loop (`lib/agent/loop.ts`) is a standard tool-use agent
  loop (≤ 10 iterations) that preserves thinking blocks across tool turns.

### The 5 tools (`lib/agent/tools.ts`)

Every tool reads the baked artifacts; the numbers below are computed **live, per request**.

1. **`get_morphology(caseId)`** — reads `morphology.json` + `hemodynamics.json`, **strips the rupture
   outcome** (age/sex/rupture never leave the tool), and returns geometry + hemodynamics **plus a
   provenance tier** it forces the model to surface, plus live-derived facts (dome-to-neck ratio,
   wide-neck flag, size band).
2. **`query_literature(query, …)`** — the RAG tool (see §8).
3. **`find_catheter_path(caseId)`** — live pathfinding (see §9).
4. **`perturb_morphology(caseId, {domeSizeMm?, neckWidthMm?})`** — the **what-if** tool. It
   *recomputes* aspect ratio and size ratio arithmetically for the new geometry, and **invalidates
   hemodynamics** (`hemodynamicsValid: false`) — it explicitly refuses to fake a CFD field for a shape
   it didn't solve.
5. **`highlight_geometry({elementIds, mode, annotation})`** — a validated passthrough that lets the
   model drive the 3D viewer as a silent spatial side-channel (vocabulary: `aneurysm_dome`, `neck`,
   `aneurysm_node`, `entry_node`, `parent_vessel`).

### The system prompt (`lib/agent/prompt.ts`)

Enforces the copilot's character: **patient data before literature** (call `get_morphology` first,
derive narrow literature queries from the patient's numbers); **dual grounding** (every claim cites a
specific patient value *and* a source id); **synthesis, not summary**; **weigh the contested WSS
evidence** (state which way the balance tips); **surface the proxy provenance**; a hard **no-outcome-leak
rule**; and a strict output contract — brief prose then a fenced `RiskAssessment` JSON (`level`,
`headline`, `reasoningSteps`, `confidence`, `whatWouldChangeMyMind`, `citationIds`, `contested`).

---

## 8. The RAG corpus

**Real retrieval, not a stub.** `lib/agent/corpus/` holds 6 authored literature files totalling
**42 chunks**, each with a real citation and rich epistemic metadata (`topic`, `subtopic`,
`direction`, `contested`, `evidence` type, `applies_to`). The hemodynamics file is deliberately seeded
with the genuine **high-WSS-vs-low-WSS controversy**, so the model has to reason about conflict.

- **Index (offline):** `scripts/index-corpus.ts` embeds every chunk with Google
  `gemini-embedding-001` (1536-dim, L2-normalized) → committed `corpus/embeddings.json` (~1.3 MB of vectors).
- **Retrieval (live):** `lib/agent/retrieval.ts` embeds the query with the same model and ranks by
  cosine. It stamps the embedder name in the index and checks it at query time (mismatch guard). If
  `GEMINI_API_KEY` is missing or the model mismatches, it **degrades loudly** to a token-overlap
  keyword scorer rather than erroring — and reports which mode it used.

---

## 9. Catheter routing — exactly how the route is found

There are **two distinct pieces**, and the distinction matters:

- **The reasoning numbers = live Dijkstra.** `find_catheter_path` (`lib/agent/tools.ts`) runs a
  hand-rolled Dijkstra over `graph.json` edges: undirected adjacency, an edge with
  `mean_radius_mm < 0.35 mm` is **dropped as hard-impassable** (a catheter can't fit), and it routes
  from a virtual super-source over all `entry_nodes` to the `aneurysm_node`. **Edge cost =
  `length_mm × tortuosity`** — tortuosity is the operative difficulty driver. It returns per-segment
  difficulty, total length, max tortuosity, min radius, a normalized difficulty score, and an honest
  note on whether the caliber constraint actually binds. **It returns metadata, not a drawn line.**
- **The drawn 3D polyline = baked.** The gold route the clinician *sees* comes from the offline
  `catheter_paths.json` (computed by `graph_qa.py`), rendered by the viewer's animated search.

So Claude's *difficulty reasoning* is computed live over the graph, while the *geometry* it draws was
solved offline — both from the same vessel graph.

---

## 10. The 3D viewer

- **What renders:** the live console (`/console`) embeds `public/viewer.html` in an iframe. It's plain
  **Three.js 0.160** (loaded via CDN importmap). It draws a **translucent deep-red vessel tree**, an
  **amber aneurysm sac** (with a per-vertex `COLOR_0` **WSS heatmap** you can swap on), graph
  nodes/edges (colored by type, culled by a voxel occupancy grid so nothing floats outside the mesh),
  **pulsatile blood-flow particles** (~1.1 Hz cardiac surge, dark→bright by speed), a **WSS legend +
  peak/low hotspot markers** from `wss.json`, and the **animated multi-source Dijkstra catheter search**
  (explore → converge → gold `TubeGeometry` reveal) along the baked route.
- **How the agent drives it:** for every streamed tool event, `components/console/copilot/agentDirector.ts`
  translates it into a `postMessage` to the iframe (`viewerBridge.ts`). Vocabulary: `setCase`,
  `focusAneurysm`, `setLayer{id,on}`, `setWss{on}`, `reset`. So `get_morphology` frames the sac, a
  flow-flavored `query_literature` turns on WSS + streamlines, and `find_catheter_path` triggers the
  catheter search — all in sync with the reasoning stream.

> **Note (dead code):** there is a complete *second*, native react-three-fiber viewer
> (`components/console/VesselViewer.tsx` + `components/console/viewer/*`, driven by the Zustand store in
> `lib/store.ts`) that is **not imported anywhere** — a superseded earlier implementation. The shipped
> console renders the iframe, not this. The npm-pinned `three@^0.136.0` is used only by the landing-page
> hero and that dead viewer; the *live* 3D runs `three@0.160.0` from the CDN.

---

## 11. What is genuinely computed vs. a labeled proxy

This is the project's **CFD-honesty rule** made explicit — the reasoning layer is deep; the physics
layer is mostly a labeled proxy.

| **Genuinely computed by our code** | **A labeled proxy / dataset-provided** |
|---|---|
| Mesh cleaning + GLB export | All WSS / OSI / streamlines **except CMHA** = analytic Poiseuille proxy (flagged, not a solver) |
| TOF-MRA `.nii` → 3D vessel surface (marching cubes) | Raw surface geometry & Aneurisk centerlines (parsed from datasets) |
| Centerline → graph, tortuosity, node typing, skeletonization | Clinical age / sex / rupture / location (dataset CSVs) |
| Aneurysm sac detection (centerline deviation) | CMHA's WSS/OSI/morphometry (computed by the *dataset authors*, not us) |
| Size morphometrics from the sac mesh | The real aneurysm mask for HERO (manual dataset label) |
| Catheter routing (Dijkstra shortest path) | The drawn route polyline (baked offline) |
| Live RAG retrieval (Gemini embeddings + cosine) | — |
| Live what-if perturbation arithmetic | — |
| Claude's reasoning, grounding, and hedging | — |

**Bottom line:** the *reasoning + graph + geometry* story is real computation; the *flow/physics* story
is an honest analytic proxy for every case but CMHA. Closing that gap is what [`IDEAS.md`](IDEAS.md) is about.

---

## 12. Known gaps / not-yet-real

- **Tier-2 CFD (SimVascular) is never run** — hemodynamics is a proxy except for CMHA's dataset values.
- **4 synthetic + 1 partial case fail the contract** — they're viewer fixtures, not real data.
- **A whole dead native r3f viewer** (`VesselViewer` + `components/console/viewer/*`) is unreferenced.
- **`CLAUDE.md` has drifted** — it describes a Python `app/agent/` MCP layout and "4 tools"; the real
  agent is TypeScript in `lib/agent/` with **5 tools**.
- **The Phase-1 sphere-clip aneurysm isolation is a placeholder** (superseded by `aneurysm_detect.py`).
- **`highlight_geometry` under-delivers** — the agent names elements to highlight, but the viewer
  currently just re-focuses rather than visually isolating the named part.

**→ For concrete ideas to add real computational depth (and the tumor/oncology question), see
[`IDEAS.md`](IDEAS.md).**
