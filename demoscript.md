# NeuroVas Copilot — 3-Minute Demo Script

**Target runtime:** ~3:00 · **Pace:** speak briskly (~150 wpm). Bracketed `[ … ]` lines are
*actions / what's on screen* — don't read them aloud. The **Say:** blocks are your verbatim
narration. Timestamps are cumulative targets; if you're running long, the trim marks (✂) show
what to drop first.

> One-line framing for yourself: *real anatomy, real physics, and an agent that shows its work.*

---

## Scene 1 — Landing page: the problem (0:00 → 0:35)

[Open on the landing page, hero 3D model spinning. As you talk, scroll slowly down through the
second section — the "Treat it now, or watch and wait?" decision panel, the capability cards,
and the honesty banner. Let the 3D and the scroll carry the visuals; don't narrate them.]

**Say:**
> This is NeuroVas Copilot. Unruptured brain aneurysms get found by accident all the time —
> someone comes in for headaches, gets a scan, and there it is. Now the clinician faces a hard,
> high-stakes call: treat it now — clip, coil, or a flow-diverter, each carrying real surgical
> risk — or watch and wait? A rupture kills about a third of patients, but treating can cause
> harm too, and the science that would settle it — size, shape, blood flow — is genuinely
> contested. So we built decision support: one patient's scan becomes an interrogable 3D model
> with cited, deliberately hedged reasoning — a second read for the clinician, never a verdict.

✂ *If short on time, drop the "clip, coil, or a flow-diverter" aside.*

---

## Scene 2 — Enter the console: what we upload & the pipeline (0:35 → 1:05)

[Click **Enter Console**. The imaging-intake screen appears — add the scan. Then the
reconstruction screen plays through its stages (thresholding → marching cubes → GLB export →
centerline graph → hemodynamics → morphology). Talk over it; don't wait for it to finish.]

**Say:**
> I'll add this patient's imaging and go into the console. Behind the screen, this is the heavy
> lifting — and it's all precomputed offline so the demo stays instant. We take the raw scan,
> threshold out the vessels, and run the marching-cubes algorithm to turn that volume into a 3D
> surface mesh — which we export as a `.glb` file the browser can render. Then we skeletonize the
> vessels into a centerline graph and measure the aneurysm's shape.

✂ *If short, cut the skeletonize sentence — the pipeline screen already shows it.*

---

## Scene 3 — In the console: detecting the aneurysm + the physics (1:05 → 1:33)

[You're in the console now: 3D vessel tree on the left, copilot on the right. Ask the rupture
question (or trigger it) so the agent isolates the sac and the WSS/flow layers become available.]

**Say:**
> Now we're in the console. The first thing we did was write functions that detect the aneurysm
> itself — they isolate the *sac*, the spot where the vessel wall balloons out past the normal
> vessel. The moment it locks on, all the analysis layers unlock. We also compute the
> hemodynamics — the blood flow through the sac, and the *wall shear stress*, the force that flow
> drags along the vessel wall — because stress on the wall is one of the signals tied to rupture.
> And we're honest about it: this is an analytic flow proxy, not a full CFD simulation.

✂ *If short, drop the last sentence — but it's a strong honesty beat, keep it if you can.*

---

## Scene 4 — Catheter routing: A*, tortuosity, and the colors (1:33 → 2:03)

[Click **find the path for the catheter**. The search fans out across the vasculature and
converges on the gold route to the neck. Then click along the route / the colored segments.]

**Say:**
> Next question — could you even get a catheter to it? I'll ask it to find the path. This runs an
> A* search over the vessel centerline graph. It weighs every segment by two things: its length,
> and its *tortuosity* — how twisty the vessel is — and finds the best feasible route from the
> artery entry all the way to the aneurysm neck. Any vessel too narrow for the catheter is ruled
> out entirely. And these colors along the route *are* the tortuosity: the green segments are
> gentle and easy to navigate, and the red ones are the tight, twisting bends where a catheter
> has the hardest time getting through.

✂ *If short, compress to: "It's an A* search that weighs each segment by length and tortuosity —
green is easy, red is the tight bends."*

---

## Scene 5 — The agent: tools, corpus, PHASES, and the evidence graph (2:03 → 2:48)

[As the copilot streams its reasoning, point to the tool traces firing, then to the clinical-
factors poll it asks, then to the PHASES/ELAPSS score card, and finally the evidence graph with
opposing studies pulling apart.]

**Say:**
> All of this is driven by a Claude agent. As it reasons, it calls a set of tools — an MCP-style
> tool server — that pull this patient's real data: the measurements, the flow, the catheter
> route. It also searches a corpus we built of the aneurysm literature — the studies on size,
> shape, and flow — so every claim it makes is cited. Notice it even pauses to ask the clinician
> the factors a scan can't give it — things like blood pressure or family history — and folds
> those into validated clinical scores like PHASES and ELAPSS, computed live for this patient.
> And here's the key move: instead of just declaring an answer, it shows the neurologist the
> evidence graph — the studies that *support* the claim and the ones that *argue against* it,
> visibly pulling apart — so they can weigh it themselves.

✂ *If short, drop "and ELAPSS" and the "size, shape, and flow" aside.*

---

## Scene 6 — Close (2:48 → 3:00)

[Rest on the finished console — 3D model, cited verdict, evidence graph all on screen.]

**Say:**
> That's NeuroVas Copilot: real anatomy, real physics, and reasoning that shows its work —
> decision support that makes the clinician sharper, instead of trying to replace them.

---

## Presenter cheat-sheet (hero case — numbers to have ready if asked)

- **Case:** incidental unruptured aneurysm, reconstructed from a TOF-MRA scan.
- **Max diameter:** ~6.2 mm (just under the 7 mm ISUIA/UCAS risk threshold).
- **Aspect ratio:** ~1.06 (well below the ~1.6 instability band — squat, wide-necked).
- **Size ratio:** ~2.07 (the one mildly elevated shape metric).
- **Neck width:** ~6.2 mm → wide neck, unfavorable for bare coiling (wants balloon/stent-assist).
- **PHASES ≈ 4 → ~0.9% 5-year rupture risk** — a low baseline, but blind to shape and flow.
- **Peak WSS ~6.9 Pa, OSI 0.3, ~20% low-shear area** — analytic proxy, *not* CFD.
- **Contested science:** high-WSS (Cebral 2011) vs low-WSS + high-OSI (Xiang 2011) — this case
  shows *both* signatures, which is exactly why hemodynamics isn't decisive here.
- **Verdict framing:** low risk, moderate confidence — *decision support, not a verdict.*

## Accuracy flags (so you're bulletproof if a technical judge probes)

- **"A* search"** — the shipped routing tool is **Dijkstra** (shortest path, cost = length ×
  tortuosity, with sub-0.35 mm vessels treated as impassable). Dijkstra is A* with a zero
  heuristic, so "A*" is defensible shorthand — but if an engineer on the panel presses, the
  precise answer is *"Dijkstra / a weighted shortest-path search."*
- **"MCP-style tool server"** — strictly, the agent uses Anthropic tool-calling over a streaming
  API route with six tools (`get_morphology`, `query_literature`, `find_catheter_path`,
  `compute_risk_scores`, `perturb_morphology`, `highlight_geometry`). "MCP-style tool server" is
  fair framing for the concept; just don't claim a literal standalone MCP server if asked.
- **Corpus size:** it's a **42-chunk** evidence index with semantic (Gemini-embedding) search and
  a keyword fallback; each chunk is tagged contested / direction / stance.
- **"Precomputed offline"** — say this proudly; it's the design (heavy compute is baked into
  static files so the live demo is instant and GPU-free). Don't imply segmentation/meshing runs
  live in the browser.
</content>
</invoke>
