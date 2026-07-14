# CLAUDE.md — NeuroVas Copilot

Guidance for Claude Code when working in this repository.

## What this is

**NeuroVas Copilot** — an interrogable 3D aneurysm copilot. One patient, one aneurysm,
one conversation: a clinician asks an AI *"will this rupture, why, what if it were bigger,
and how would you get a catheter there?"* and Claude reasons over real blood-flow physics,
medical literature, and 3D vessel anatomy — showing its work on the 3D model the whole time.

Built for a hackathon by a 2-person team:
- **Ronuk** (this repo owner) — imaging, 3D models, CFD → the bio/geometry pipeline (Phases 1–4).
- **Garvit** — the Claude reasoning agent + react-three-fiber frontend (Phases 5–6).

## Core architecture principle (read first)

**Every heavy computation runs once, OFFLINE, before the demo, and is baked into static files.**
The live demo only loads those files and reasons over them. This keeps it instant, reliable,
and GPU-free on stage. There is **no fine-tuning** — the datasets are finished 3D geometry,
not training data. The only optional model is segmentation for the single TOF-MRA showcase
case (Frangi filter — a classical image filter, no training — or a pretrained nnU-Net).

## The parallel-build mechanism (why the repo is shaped this way)

The two builders agree on file formats FIRST, then build against fakes:
1. **Day 0 (together):** define the exact schema of every handoff file in `contracts.py` +
   `types.ts`, then hand-write a folder of fake ("mock") artifacts that obey those schemas.
2. **Split:** Ronuk's pipeline produces *real* artifacts matching the contract; Garvit's app
   reads from *mock* artifacts (same shape, fake data).
3. **Merge:** flip one config path from `artifacts_mock/` to `artifacts/`.
   `validate_artifacts.py` checks a folder against the contract — run it before every merge.

**Ownership rule:** touches a scan / mesh / centerline / physics solver → Ronuk. Touches Claude
/ a tool / the RAG index / React / the 3D scene → Garvit. `contracts.py` is the ONE file both
edit, and only by joint agreement.

## Intended repo structure

```
neurovas/
├── environment.yml         # conda env for the pipeline (Ronuk's deps)
├── contracts.py            # shared schema definitions + validators (BOTH own)
├── validate_artifacts.py   # checks a case folder against the contract (BOTH run)
├── pipeline/               # ===== RONUK's domain (offline) =====
│   ├── 01_geometry.py
│   ├── 02_graph.py
│   ├── 03_cfd.py
│   └── 04_morphology.py
├── artifacts/              # ===== THE HANDOFF ===== (Ronuk fills with REAL files)
│   └── case_C0035/
│       ├── vessel_tree.glb
│       ├── aneurysm.glb
│       ├── graph.json
│       ├── streamlines.json
│       └── morphology.json
├── artifacts_mock/         # Garvit's stand-in files (same schema, fake data)
│   └── case_C0035/ ...
└── app/                    # ===== GARVIT's domain (live) =====
    ├── agent/
    │   ├── tools.py        # the 4 Claude tools
    │   ├── server.py       # exposes tools (MCP or a small API)
    │   └── corpus/         # RAG literature files + index
    ├── web/                # react-three-fiber frontend
    │   └── src/types.ts    # TS mirror of contracts.py
    └── .env                # ANTHROPIC_API_KEY (git-ignored, secrets only)
```

`.env` and `artifacts/` (large binaries) stay git-ignored.

## The interface contract (schemas — all coordinates in mm, one shared world frame)

`vessel_tree.glb`, `aneurysm.glb`, and `graph.json` must all overlay in the same frame.

**graph.json**
```json
{
  "case_id": "C0035",
  "units": "mm",
  "nodes": [ { "id": 0, "pos": [12.1, 4.4, 88.0], "type": "entry", "radius": 1.9 } ],
  "edges": [ { "id": 0, "source": 0, "target": 1, "length_mm": 12.4,
              "mean_radius_mm": 1.6, "tortuosity": 1.08, "polyline": [[1,2,3], "..."] } ],
  "aneurysm_node": 14,
  "entry_nodes": [0, 3]
}
```
- `type` ∈ `endpoint | bifurcation | aneurysm | entry`
- `tortuosity` = path length ÷ straight-line distance (≥ 1; higher = twistier)
- `polyline` lets the viewer draw the segment and the catheter path in 3D

**morphology.json** — `geometry` (max_diameter_mm, height_mm, neck_width_mm, aspect_ratio,
size_ratio, location), `hemodynamics` (peak_wss_pa, mean_wss_pa, osi_max,
low_shear_area_fraction), `clinical` (rupture_status, patient_age, patient_sex).

**streamlines.json** — `{ "case_id", "streamlines": [ { "points": [[x,y,z]...], "speed": [...] } ] }`

**GLB conventions:** vessel_tree.glb and aneurysm.glb are separate files in the SAME world
coordinates. Wall shear stress is baked as a per-vertex color (COLOR_0) on aneurysm.glb, OR a
sidecar `wss.json` — pick one and stick to it. Fix Y-up + mm once and document at the top of
`contracts.py`.

## Ronuk's phases (this repo's primary work)

- **Phase 1 — Geometry:** Aneurisk/AneuX meshes (`.vtp`/`.stl`) → clean → export `vessel_tree.glb`
  + `aneurysm.glb`. One showcase case reconstructed from a raw TOF-MRA `.nii` (nibabel → Frangi
  → marching cubes → mesh).
- **Phase 2 — Graph ★ (critical unlock):** centerline (parse Aneurisk's provided one, or run VMTK
  `vmtkcenterlines` / 3D Slicer Extract Centerline) → networkx graph → `graph.json`. **Keep a
  hand-verified backup graph for the primary hero case** — everything downstream depends on this.
- **Phase 3 — CFD:** three tiers, build bottom-up so something always works. Tier 3 analytic proxy
  (never fails), Tier 1 dataset-provided WSS/OSI, Tier 2 one real SimVascular run as the showpiece
  (never on the critical path) → `streamlines.json` + baked WSS.
- **Phase 4 — Morphology:** measure the aneurysm → `morphology.json`. Fast path: pull AneuX's
  170 precomputed morphometric indices. Compute path: diameter, height, neck width, aspect ratio,
  size ratio, location.

## Datasets

- **AneuX** (Zenodo 6678442) — 750 domes + 668 vessel trees + 170 morphometric indices + rupture
  status. Fast path to clean geometry + morphology.
- **Aneurisk** (GitHub mirror, e.g. `hkjeldsberg/AneuriskDatabase`) — vessel geometries with
  centerlines already computed. Best CFD + graph hero case.
- **Nature 2024 CTA** (Scientific Data, s41597-024-04056-8) — 99 cases with CFD-derived hemodynamics.
- **Lausanne TOF-MRA** (OpenNeuro ds003949) — open scans with aneurysm labels; the one
  reconstruction showcase case.
- **ADAM** (adam.isi.uu.nl) — requires a signed agreement mailed to organizers (takes DAYS —
  register early, use later if approved).

Confirm exact file extensions inside each download before coding. Don't assume — inspect.
Use ONLY public datasets (no lab data).

## Key rules & gotchas

- **CFD honesty rule:** the WSS↔rupture link is genuinely contested in the literature (both high
  and low WSS associate with rupture). The copilot must present hemodynamics as **suggestive,
  not decisive** — decision support, not a verdict. This honesty is a Depth-score signal.
- **Phase 2 graph is load-bearing** — pathfinding + reasoning depend on it. Hand-verified backup.
- **Real CFD can eat the week** — proxy first, dataset WSS second, one SimVascular run last.
- **Scope creep is the enemy** — build the vascular spine to done; *mention* biopsy/tumor
  generalizations, don't build them.
- Run `validate_artifacts.py` before every merge; change `contracts.py` only by joint agreement.

## Environments & commands

**Pipeline (conda, Ronuk):**
```bash
conda env create -f environment.yml   # env name: neurovas
conda activate neurovas
```
Deps: python=3.10, vmtk, vtk, numpy, scikit-image, nibabel, networkx, trimesh, pyvista, scipy,
pip: pygltflib.

**Agent (light Python, Garvit):** `pip install anthropic chromadb sentence-transformers python-dotenv fastapi uvicorn`

**Frontend (Node, Garvit):** `npm create vite@latest web -- --template react` then
`cd web && npm install three @react-three/fiber @react-three/drei`

## Running the pipeline (verified on real Aneurisk C0001)

The hero dataset (Aneurisk) is mirrored on GitHub — pull one case's files directly (no multi-GB
zip): `github.com/hkjeldsberg/AneuriskDatabase/models/C0001/` has `surface/model.vtp`,
`morphology/centerlines.vtp`, and `manifest.csv`. Save under `aneurisk/C0001/` (git-ignored).

A lean env (numpy, scipy, networkx, pandas, trimesh, pyvista) is enough for the Aneurisk path —
Aneurisk ships centerlines, so no VMTK needed. pyvista+vtk install fine on Python 3.14.

```bash
# Phase 2 — centerline -> graph.json  (adaptive weld tol; ~0.1mm sampling)
python pipeline/02_graph.py --case C0001 --centerline aneurisk/C0001/morphology/centerlines.vtp --entries 2
# Phase 1 — surface -> vessel_tree.glb + aneurysm.glb  (aneurysm-center from the graph's aneurysm_node pos)
python pipeline/01_geometry.py --case C0001 --vessel-mesh aneurisk/C0001/surface/model.vtp --aneurysm-center X Y Z
# Phase 3 — graph -> streamlines.json (Tier-3 proxy)
python pipeline/03_cfd.py --case C0001
# Phase 4 — manifest + aneurysm.glb -> morphology.json
python pipeline/04_morphology.py --case C0001 --manifest aneurisk/C0001/manifest.csv
# Verify the whole case against the contract
python validate_artifacts.py artifacts/case_C0001
```

`pipeline_selftest.py` exercises all four phases on synthetic geometry + the real AneuX CSV.

Known gaps to tighten for the demo: aneurysm isolation is a sphere-clip around the max-radius
centerline node (a placeholder — the detected "neck" is the clip boundary, so real neck/diameter
numbers are rough); Tier-1/2 CFD and the TOF-MRA reconstruction path are written but not yet run,
so hemodynamics is a flagged placeholder.

## Git

Default branch `main`. Ronuk works on branch `ronuk`. Remote:
`github.com/ronstercodes/anthropic-hackathon-project` (private).

## Source of truth

Full plans live in two PDFs (the "End-to-End Build Plan" and the "In-Depth Build Bible,
2-Person Edition"). This file is a distilled summary — when in doubt, the build bible's
per-phase checklists are authoritative.
