# NeuroVas Copilot

An **interrogable 3D cerebral-aneurysm copilot**. A clinician views a patient's
aneurysm in 3D and asks Claude — _"Will this rupture? Why — show me the flow.
What if it were 6 mm? How would a catheter get there?"_ — and the 3D view changes
to show the reasoning spatially, over precomputed hemodynamics, morphometrics, a
RAG literature corpus, and a graph abstraction of the vasculature.

Built for Anthropic's **"Built with Claude: Life Sciences"** track.

> **Architecture rule:** every heavy computation is precomputed offline and baked
> to static assets. The web app never segments, simulates, or runs CFD live — it
> loads GLBs + JSON and calls the Claude agent.

> **Honesty:** decision support, not a verdict. Rupture-risk hemodynamics are
> contested (studies link rupture to both high _and_ low wall shear stress). The
> tool shows its reasoning and sources rather than declaring an answer.

## Stack

Next.js 14 (App Router) · TypeScript · React Three Fiber + drei + **three@0.136.0**
(pinned) · Tailwind · Zustand · Framer Motion · Anthropic SDK.

## Getting started

```bash
npm install --legacy-peer-deps   # drei peers three>=0.137; we pin 0.136 on purpose
npm run gen:fixtures             # generate mock case assets into public/cases
npm run dev                      # http://localhost:3000
```

Copy `.env.local.example` → `.env.local` and set `ANTHROPIC_API_KEY` (server-side
only) when wiring the agent loop.

## Routes

| Route      | What it is                                                        |
| ---------- | ----------------------------------------------------------------- |
| `/`        | Landing — the WebGL "synapse brain" hero (mobile: static poster)  |
| `/console` | The product — 3D viewer + mode rail + copilot chat                |
| `/cases`   | Hero-case gallery → selects into the console                      |
| `/method`  | Pipeline transparency (scan → mesh → graph → CFD → agent)         |
| `/about`   | Team, datasets, honesty statement                                 |

## Layout

```
app/            routes (landing, console, cases, method, about)
components/      hero/ (BrainHero port) · console/ (viewer, mode rail, chat)
lib/            shaders.ts · store.ts (Zustand = agent event bus) · cases.ts · palette.ts
types/          the fixed pipeline↔frontend interface contract
public/cases/   per-case GLB + JSON assets (mock fixtures for now)
scripts/        gen-fixtures.mjs (mock assets) · smoke*.mjs (headless verification)
```

## Notes

- `three@0.136.0` is pinned app-wide and must not be upgraded — the hero's shader
  chunks and `LineMaterial` internals are version-sensitive, and r136's
  `examples/jsm` imports resolve a single bare `three`. Paired with
  `@react-three/fiber@8.6.2` + `@react-three/drei@8.20.2`.
- Datasets are **public only**: AneuX (Zenodo 6678442), Aneurisk, Nature Sci Data
  2024 CTA, Lausanne TOF-MRA (OpenNeuro ds003949).

## Status

Delivery 1 (design system, all routes, the BrainHero port, and the VesselViewer
with Anatomy mode) is complete. Copilot chat + tool traces, Hemodynamics, What-If,
Navigation, the real Python agent tools, and demo-safety fallbacks are next.
