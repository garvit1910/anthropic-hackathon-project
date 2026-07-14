# app/ — Garvit's domain (the live copilot)

Not built here. This folder is a placeholder so the repo structure matches the build bible and
the merge target exists. Garvit owns everything under `app/`:

- `agent/` — the 4 Claude tools (`get_morphology`, `query_literature`, `find_catheter_path`,
  `highlight_geometry`/`perturb_morphology`), the tool server (MCP or small API), the RAG corpus.
- `web/` — the react-three-fiber viewer.
- `.env` — `ANTHROPIC_API_KEY` (git-ignored).

The app reads the same contract files the pipeline emits. During the build it reads
`artifacts_mock/`; at integration (Phase 7) it flips to `artifacts/`. The seam is `contracts.py`
at the repo root — the TypeScript types under `web/` mirror it.
