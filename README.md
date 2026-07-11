# NeuroVas Copilot

An interrogable 3D aneurysm copilot. One patient, one aneurysm, one conversation: a clinician
asks *"will this rupture, why, what if it were bigger, and how would you get a catheter there?"*
and Claude reasons over real blood-flow physics, medical literature, and 3D vessel anatomy —
showing its work on the 3D model the whole time.

**Core principle:** every heavy computation runs once, offline, and is baked into static files.
The live demo only loads those files and reasons over them — instant, reliable, GPU-free.

## Layout

```
contracts.py            # the interface contract (schemas + validators) — the seam between builders
validate_artifacts.py   # check a case folder against the contract (run before every merge)
environment.yml         # conda env for the pipeline

pipeline/               # Ronuk — the offline pipeline (Phases 1-4)
  01_geometry.py        #   meshes/scan  -> vessel_tree.glb + aneurysm.glb
  02_graph.py           #   vessels      -> graph.json  ★ critical
  03_cfd.py             #   flow physics -> streamlines.json + baked WSS
  04_morphology.py      #   measurements -> morphology.json

artifacts/              # THE HANDOFF — real files land here (git-ignored binaries)
artifacts_mock/         # committed fake-but-valid files so the app builds without waiting
app/                    # Garvit — the Claude agent + react-three-fiber viewer (Phases 5-6)
```

## Who owns what

Touches a scan / mesh / centerline / physics solver → **Ronuk** (`pipeline/`).
Touches Claude / a tool / the RAG index / React / the 3D scene → **Garvit** (`app/`).
`contracts.py` is the one file both own, changed only by agreement.

## Pipeline setup

```bash
conda env create -f environment.yml
conda activate neurovas
python validate_artifacts.py artifacts_mock   # should print ALL CASES PASS
```

See [CLAUDE.md](CLAUDE.md) for the full project context, contract schemas, phase plan, and datasets.
