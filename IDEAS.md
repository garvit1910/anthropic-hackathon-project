# NeuroVas Copilot — Ideas to Add Depth (Brainstorm)

> **Read [`current_status.md`](current_status.md) first.** Short version: the **reasoning layer is
> genuinely deep** (real RAG with Gemini embeddings, live Dijkstra catheter routing, live what-if
> perturbation, contested-evidence synthesis, a sealed outcome-leak), but the **physics/biology layer
> is mostly a labeled analytic proxy** — the geometry is real, but WSS/OSI/streamlines are analytic
> for every case except CMHA. That gap is exactly why the build can *feel* like "precomputed meshes +
> an agent on top." **Every idea below is about closing that gap: turning narration into computation
> the clinician can see, interrogate, and stress-test.**
>
> Two independent brainstorm passes converged on the same top picks (live what-if slider, confidence
> decomposition, cohort atlas) — those are called out as high-confidence.
>
> Effort scale: **S** ≈ under 2h · **M** ≈ 2–5h · **L** ≈ a day+.

---

## Group 0 — How this actually helps doctors (make the clinical value legible)

> Right now the build shows *capability* (3D + reasoning) but never states the **decision it
> supports**, so a viewer can't tell what problem it solves. This is the most important gap to close
> for the demo — arguably before any depth feature. The features here are cheap; their job is to make
> "what are we doing, and who does it help?" obvious in the first 10 seconds.

**The clinical problem, in one sentence.** Unruptured intracranial aneurysms are found *incidentally*
all the time (on an MRA/CTA done for headaches, dizziness, etc.), and the clinician then faces a
genuinely hard, high-stakes call: **treat it now** (clip / coil / flow-diverter — each carries real
procedural risk) or **watch it** (surveillance imaging), and *how urgently*. Rupture is catastrophic
(subarachnoid hemorrhage, ~⅓ mortality), but treatment can also cause harm, and the rupture-risk
science (size, shape, hemodynamics) is **contested**. NeuroVas Copilot is a **decision-support**
tool for exactly this call: it turns one patient's scan into an interrogable 3D model plus grounded,
cited, deliberately-hedged reasoning — a clinician-in-the-loop second read, not an autonomous verdict.

**Who it helps, and how:**

| Persona | Their question | How the copilot helps |
|---|---|---|
| **Neurosurgeon / neuro-interventionalist** | "Treat or observe? Clip vs coil? Can I even get a catheter there?" | Risk stratification grounded in this patient's numbers + literature; catheter **deliverability/access brief** (see A3 + B1); neck/dome geometry for clip-vs-coil feasibility. |
| **Neurologist / stroke physician** | "Do I refer this incidental finding, or set a surveillance interval?" | Fast triage + a **surveillance plan** (what to watch, when to re-image) and a growth what-if that shows when the decision would flip. |
| **Neurovascular MDT / tumour-board-style conference** | "What's the consensus on this case?" | A shared, visual, cited case brief the whole room reasons over together — and an auto-generated structured note for the record. |
| **Radiology** | "How do I convey risk beyond 'X mm aneurysm, ICA'?" | Computed morphometry + validated scores (PHASES/ELAPSS) + a picture, instead of a bare measurement line. |
| **Trainees / residents** | "*Why* is this higher risk?" | A transparent, interrogable reasoning trail — a teaching tool that shows the working, including where the evidence disagrees. |
| **The patient (via the clinician)** | "Should I be worried? What are my options?" | A plain-language, own-anatomy view of the trade-offs for the consent / shared-decision conversation. |

**Concrete clinician-facing features (cheap, high-clarity — build these to communicate value):**

1. **A persistent "what this decides" banner** — *S.* A one-line header in the console stating the
   supported decision (e.g. *"Decision support: treat vs. observe this unruptured aneurysm"*) so
   anyone watching instantly gets the point. The single highest-ROI clarity fix.
2. **Auto-generated structured MDT / chart note** — *M.* At the end of a conversation, emit a cited,
   structured summary — measurements, validated scores, risk level + confidence, recommendation
   caveats, and "what would change my mind" — formatted to paste straight into a neurovascular-board
   record. Turns the reasoning into a clinical *artifact*, which is what makes it real to a doctor.
3. **Shared-decision patient view** — *M.* A simplified toggle that shows the patient their own 3D
   aneurysm plus a plain-language **treat-risk vs. rupture-risk** trade-off — the consent conversation,
   made concrete and personal.
4. **Surveillance planner** — *S–M.* For an "observe" outcome, recommend an imaging interval and the
   specific things to watch (growth, a new bleb), and tie the **growth what-if** (A2) to it: *"if it
   reaches 8 mm or grows on serial imaging, we'd re-open the treat question."* Growth on serial imaging
   is already the copilot's stated top "what would change my mind."
5. **Pre-procedure access brief** — *reuses A3 + B1.* Package catheter deliverability + the fly-through
   into a one-glance brief for the interventionalist: *"expect a moderately hard delivery — two >90°
   hairpins in the siphon, access angle 40°."* Helps them anticipate a difficult case before scrubbing in.
6. **Second-opinion / devil's-advocate mode** — *S.* Have the copilot explicitly list the factors that
   argue the *other* way and a "have you considered…" prompt — countering automation bias and making it
   feel like a colleague, not an oracle. Fits the existing hedging character exactly.
7. **Incidental-finding triage flag** — *S.* A quick red/amber/green on a newly-found aneurysm to help
   prioritise which incidentals get specialist review first.

**Positioning & honesty (state this in the demo).** It is **decision support with the clinician in the
loop**, not a diagnostic device and not a rupture prediction. Its whole design — grounding every claim
in a patient value *and* a source, surfacing contested evidence, hedging, and never stating the known
outcome — is what lets it *augment* judgment safely instead of replacing it. That honesty is the
feature, not a caveat.

---

## Group A — Add real computational depth (compute it, don't narrate it)

Each of these adds a tool in `lib/agent/tools.ts` (`+ TOOL_DEFS + runTool`), a usage/honesty rule in
`lib/agent/prompt.ts`, and a UI surface in `components/console/copilot/RiskCard.tsx`. Ranked by
impact-to-effort.

1. **Live PHASES / ELAPSS risk scores as a tool** — *4–6h.*
   A `compute_risk_scores` tool derives the *validated clinical* rupture-risk instruments (PHASES,
   ELAPSS) from our own size + location + age, returning a **per-component point breakdown → 5-yr
   rupture %**. Age/sex are read **server-side only** (they're predictors, not the outcome — the leak
   stays sealed). **Killer detail:** CMHA already ships published `phase_score`/`elapss_score`, so we
   can *demonstrate our computed score reproducing the dataset's own instrument, live*, and let the
   clinician interrogate it component-by-component. Honesty: population predictor, not individual
   certainty; unknown components (hypertension, prior SAH) flagged as assumed-absent lower bounds.

2. **Growth what-if → risk delta** — *2–3h on top of #1.*
   The existing what-if slider drives `perturb_morphology`; now it *also* re-runs the PHASES arithmetic:
   "6.2 → 8 mm ⇒ PHASES 3 → 4, ~1.3% → 2.4% / 5 yr." Slider-driven, so the clinician explores the
   sensitivity themselves. Hemodynamics stay invalidated (existing honesty rule preserved).

3. **Catheter deliverability from polyline curvature** — *5–7h.*
   Graph edges already carry dense polylines (~200 pts/edge) — untapped signal. Along the routed path
   compute discrete curvature κ, min curvature-radius, integrated **bending energy ∫κ²ds**, cumulative
   turn angle, **hairpin count**, and the **ostium access angle** (parent-vessel axis vs sac inflow).
   Fold into a deliverability score decomposed as caliber / tortuosity / curvature / hairpins —
   replacing today's single tortuosity scalar. The viewer highlights the hairpin vertices on the route.

4. **1D steady-flow network solve** — *6–9h. The flagship "real physics" item.*
   Treat the graph as a **Hagen–Poiseuille resistor network** (R = 8μL/πr⁴ per edge), impose inflow at
   entries + outlet pressures, and solve the conductance-Laplacian linear system for nodal pressures →
   per-edge flow **that conserves and splits at bifurcations** → v = Q/A → WSS = 32μQ/πr³. Streamline
   speeds then derive from *solved* flow, not the current 1/radius heuristic. This re-tiers hemodynamics
   from `3-analytic-proxy` to `2-1D-network-solve` — the single biggest "we compute physics, not narrate
   it" jump. Honesty: still 1D, rigid-wall, no sac recirculation — a legitimate reduced-order solve, not
   3D CFD. (**Womersley refinement**, +4–6h, makes OSI a *computed* pulsatile quantity instead of a
   placeholder.)

5. **Laplace-law wall-tension estimate** — *2–3h.*
   Wall tension T = P·r/2 and the sac-to-parent tension ratio from our two radii — the computed
   *mechanistic* reason larger radius carries more wall stress, feeding the "size matters" argument with
   a number rather than a citation. Honesty: thin-wall spherical idealization, assumed pressure/thickness.

6. **Automated measurement self-audit** — *4–6h.*
   Recompute each morphometric two independent ways (max-diameter: convex-hull pairwise vs bbox;
   neck-width: boundary-loop max-pairwise vs plane-fit), report **± spread + a confidence flag**. On
   CMHA, compare our values to the dataset's *published* morphometry ("our D_max 3.2 mm matches the
   published 3.2 mm"). Measurements become **verified, not asserted** — a trust anchor.

7. **Cohort nearest-neighbor retrieval** — *5–7h.*
   Build a z-scored morphology feature vector [size, AR, SR, location] over the **105-case CMHA cohort**;
   for the patient, find the k nearest real cases and report their observed rupture fraction + PHASES
   distribution. A *computed empirical base rate*, not a generic literature quote. Honesty: retrospective,
   small-k variance, associational not causal.

8. **Sensitivity / uncertainty analysis** — *4–6h.*
   Monte-Carlo propagate ±~0.3 mm voxel-scale measurement error through AR / SR / PHASES / deliverability
   → **90% intervals + a tornado chart** of which input the risk band is most sensitive to. Turns the
   RiskCard's `confidence` field from a vibe into a computed quantity.

9. **Irregularity / bleb detection & shape indices** — *5–7h.*
   Compute the "irregular shape" rupture correlate ourselves: non-sphericity index, undulation, and
   **blebs as convexity defects** (scipy `ConvexHull` is already imported in `04_morphology.py`). Feed an
   "irregular" flag into ELAPSS; viewer highlights the bleb vertices. (Also: **ostium neck-plane +
   rendered neck disk** with computed neck *area* and dome tilt — *5–7h* — for clip/coil feasibility.)

10. **Transparent risk-aggregation ledger** — *3–5h, build last.*
    An auditable additive rubric over the computed features above (size band, size ratio, irregularity,
    Laplace tension ratio, cohort rupture fraction, PHASES) → a single interrogatable index with each
    term's signed contribution. Not ML — a documented, re-weightable rubric the clinician can audit.

**Best first sprint (mutually reinforcing, all validate against CMHA, minimal new infra):**
#1 → #2 → #5 → #6. **Flagship to schedule deliberately:** #4 (the 1D flow solve; #11-style Womersley
and better streamlines stack on it). **Feeder chain:** #9 feeds #1/#7; #1/#5/#7/#9 all feed #10.

---

## Group B — Make "showing its work" visually undeniable (mostly reuse existing viewer infra)

Ranked by perceived-depth-per-hour. Most of these piggyback on curves/graphs/data already in memory.

1. **Virtual catheter fly-through (first-person endovascular navigation)** — *S–M. Top wow-per-hour.*
   After "how would you get a catheter there?", the camera dives *into* the vessel at the entry node and
   **flies the computed route** to the sac, first-person. The viewer already builds the route as a
   `CatmullRomCurve3` for the gold tube — add a "fly" mode animating the camera along `getPointAt(t)`
   looking toward `getPointAt(t+ε)`, with a live "distance to target · tortuosity" HUD. Reads as
   *navigation*, not narration.

2. **Interrogable literature-evidence graph** — *M. Highest novelty.*
   Render the agent's evidence base as a live graph, not a citation list: the patient at the center,
   retrieved sources orbiting, colored by stance (high-WSS vs low-WSS vs neutral) and direction
   (increases/decreases risk); **contested sources visibly tug in opposite directions**; click a node →
   the passage. The RAG *already returns* `stance`/`contested`/`direction`/`relevanceScore` per source —
   no new backend, just render `message.sources`. This literally visualizes the "weigh conflicts, don't
   shrug" rule; most hackathon RAGs have no epistemic structure to show.

3. **Live what-if slider + ghost "twin" sac** — *M.*
   Call `perturbMorphology` **client-side per slider tick** (no LLM round-trip); AR/SR numbers tick live
   and a **ghosted twin sac** inflates beside the real one (clone `aneurysm.glb`, scale about the
   centroid). Crucially, **grey out the flow layer** using the tool's `hemodynamicsValid:false` — so
   you're *showing* the "CFD is stale for a new shape" honesty rule, not just asserting it.

4. **Confidence-decomposed risk gauge** — *M.*
   Replace the single gauge with a **signed factor-contribution (tornado) bar**: size band, size ratio,
   low-shear fraction, location, aspect ratio — each adverse / protective / **inert**, sized by influence,
   tagged with its citation and a contested flag. Add one `factors:[{name,direction,weight,citationId,
   contested}]` field to the `RiskAssessment` schema. The "aspect ratio is *inert* for a squat sac"
   nuance becomes a visible grey bar — a great "this tool doesn't double-count" moment.

5. **Make `highlight_geometry` actually highlight** — *S–M. Cheap, but lands the whole thesis.*
   Today the agent emits `highlight_geometry(["neck"])` but the viewer only re-focuses. Wire named
   elements (dome / neck / parent_vessel / entry_node / aneurysm_node) to a flash/outline so the 3D
   tracks the agent's **prose word-by-word** ("neck" → the neck ring flashes; "dome" → the dome glows).

6. **Measurement callouts drawn on the mesh** — *S–M.*
   CAD-style calipers on the sac (max-Ø, neck width, dome height) as 3D-anchored labels with leader
   lines. Reuse the viewer's existing HTML-label projector (already used for WSS hotspots). Makes the
   model feel *measured*, clinical, trustworthy.

7. **Cohort / atlas scatter** — *M.*
   Plot the patient as a highlighted point in a morphometric scatter (size vs size-ratio) against an
   **AneuX dome cloud colored by rupture status** (built once, offline). Dramatizes the honesty point
   "base rate is a population, not this individual." (Use the `dataviz` skill for a clean chart.)

8. **Voice interrogation** — *S. Crowd-pleaser, shallow depth.*
   Browser `SpeechRecognition` → the existing `/api/agent` stream; `speechSynthesis` reads the headline.
   No backend change. Keep the text composer as the primary path — treat voice as garnish (stage mic risk).

**If you build only three:** #1 (fly-through), #2 (evidence graph), #3 (what-if twin). All three read as
*computed*, not narrated, and raise perceived depth the most.

---

## Group C — The tumor / oncology question (honest verdict)

**Recommendation: do NOT build a second full tumor interrogation flow. Build a tightly-scoped "same
engine, second modality" coda (~half a day, low risk); treat vascular-oncology as a data-gated stretch;
narrate biopsy trajectory only.** The reasoning is grounded in what the pipeline actually is.

**The key insight:** the offline pipeline is genuinely **modality-agnostic**. `reconstruct_from_tof_mra()`
+ the generic `export_glb()` already do `volume → mask → marching_cubes → mm-world → GLB`, and the
centerline-deviation blob detector is exactly the shape of "find a bulge." The same engine that turns a
vessel scan into an interrogable 3D model could turn a **tumor** scan into one. The *rendering*
generalization is nearly free; the *reasoning* generalization is the expensive part.

- **Option 1 — modality coda (RECOMMENDED, S–M, low risk).**
  A public BraTS-style brain-tumor dataset *ships the segmentation mask* — the hard part is done. A tumor
  GLB is ~10 lines mirroring the `aneurysm.glb` loader. Ship it as a **20-second closing flourish**, not
  a second interrogation: switch the viewer to a reconstructed tumor and have the copilot state 3–4
  grounded facts (volume mm³, lobe/location, distance to nearest major vessel via the proximity test the
  viewer already has), explicitly framed as *"the same engine, a different modality."* Maximum
  platform-generality signal per hour, minimal dilution. **Don't** add a full tumor RAG + risk flow —
  that becomes a second project and dilutes the aneurysm depth.

- **Option 2 — vessel feeders / tumor encasement (MOST impressive, but DATA-GATED stretch, M + data risk).**
  If a tumor mesh and the vessel graph share a frame, "which vessels feed / are encased by the tumor?" is
  a proximity/containment query — and the viewer *already does this class of test* (the `vgrid` occupancy
  grid that culls graph nodes outside the vessel mesh). Invert it: flag graph edges whose polyline passes
  within R mm of (or inside) the tumor surface = candidate feeders / encased segments; a small
  `tumor_vessel_relations` tool lights them up while the agent reasons "the mass encases ~40% of this M2
  segment; these two feeders enter it." That's real, not narrated. **The blocker is honest data, not
  code:** you need ONE public case with *both* a tumor segmentation *and* a co-registered vessel
  tree/centerline in the same subject. **Timebox sourcing to ~2h.** If found, build it — it's the
  strongest oncology wow. If not, **stop** and fall back to Option 1. **Never** bolt subject-A's tumor
  onto subject-B's vessels — fake co-registration is the one dishonesty that sinks credibility with a
  clinician judge.

- **Option 3 — biopsy-needle trajectory (NARRATE ONLY, don't build).**
  Seductive, but the "same machinery" claim is *false* and you should know that internally: our
  pathfinding is Dijkstra over a **1-D vessel centerline graph** (routing *inside* tubes). A biopsy needle
  path is a near-straight line through **3-D soft tissue** from a skull entry to the tumor, penalized by
  proximity to vessels and eloquent cortex — a different problem (3-D volumetric cost search over a voxel
  lattice), net-new code, not a reuse of `find_catheter_path`. Exactly the scope creep `CLAUDE.md` warns
  against. Mention it as a roadmap line and move on.

**Scope-creep verdict:** `CLAUDE.md`'s "mention generalizations, don't build them" is right about the
*reasoning* generalization (tumor corpus + risk flow) and the biopsy pathfinder — but slightly too
conservative on the *rendering* generalization (Option 1 is nearly free). **Keep the aneurysm
interrogation as the demo's center of gravity; the tumor is a closing flourish, never a co-headliner.**

---

## Suggested overall build order (≈2 polish days)

1. **Catheter fly-through** (B1) — biggest wow, smallest lift, reuses the existing route curve.
2. **Interrogable evidence graph** (B2) — highest novelty, the backend already emits the data.
3. **Live what-if slider + twin + stale-flow honesty** (B3) — reads as genuinely computed.
4. **`highlight_geometry` actually highlights** (B5) — cheap polish that makes the whole
   "reasoning drives the 3D" thesis land.
5. **Live PHASES / ELAPSS + growth delta** (A1 + A2) — validated clinical scores, reproduced against CMHA.
6. **Tumor modality coda** (C, Option 1) — the generality flourish, shown last.

**Stretch (time/data permitting):** 1D flow solve (A4) · confidence decomposition (B4) ·
cohort atlas (A7 / B7) · feeder-encasement (C, Option 2).

---

### Where each idea plugs in (critical files)

- `lib/agent/tools.ts` — every Group-A tool (fn + `TOOL_DEFS` + `runTool`); `perturbMorphology` (slider)
  and `findCatheterPath` (fly-through source); a future `tumor_vessel_relations`.
- `lib/agent/prompt.ts` — one usage/honesty rule per new tool.
- `pipeline/03_cfd.py` — the 1D network flow solve (A4) + Womersley replace `analytic_hemodynamics`.
- `pipeline/04_morphology.py` — offline bake for A6/A9/neck-plane + the CMHA published-value validation.
- `pipeline/01_geometry.py` — `reconstruct_from_tof_mra()` + `export_glb()`: the generic
  mask → marching-cubes → GLB path that turns a tumor mask into an interrogable mesh with zero new code.
- `public/viewer.html` — fly-through camera, twin sac, named-element highlighting, measurement
  callouts, any tumor GLB layer.
- `components/console/copilot/agentDirector.ts` — agent-event → `postMessage` bridge for new
  camera-fly / highlight / tumor commands.
- `components/console/copilot/RiskCard.tsx` — surfacing computed scores / ledger / uncertainty; sibling
  to a new EvidenceGraph component fed by `message.sources`.
- Data the features consume: `artifacts/case_*/{morphology,graph}.json` (geometry + polylines) and the
  CMHA cohort CSVs (105-case morphology + outcome + published PHASES/ELAPSS ground truth for #1/#6/#7).
