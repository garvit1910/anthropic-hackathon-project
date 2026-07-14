/**
 * heroScript — the hard-coded reasoning transcript for the hero case (HERO_sub013).
 *
 * The live agent streams the same `AgentServerEvent`s that `useAgentStream.handleEvent`
 * already consumes (rendering the panel AND driving the 3D via `directorHandle`). For the
 * single showcase case we replay a scripted, faithful version of that stream on a timer so
 * the demo is instant and reliable (no API / tunnel buffering), reveals incrementally, and
 * lets us choreograph the camera precisely.
 *
 * A run is an ordered list of `Beat`s. Each beat waits `delayMs`, then either feeds an
 * `AgentServerEvent` to the reducer (`event`) or posts a camera command straight to the
 * viewer iframe (`viewer`). Content mirrors what the real reasoning core produces for this
 * case — same measured numbers, same contested-science framing.
 */

import type { AgentServerEvent, Citation, RiskAssessment } from "@/lib/agent/types";
import type { ViewerMessage } from "./viewerBridge";
import { scorePhasesElapss, type ClinicalFactors, type ScoreDataInputs } from "@/lib/agent/scoring";

/** delayMs is the pause BEFORE this beat fires. */
export interface Beat {
  delayMs: number;
  event?: AgentServerEvent; // → handleEvent (reducer + directorHandle 3D)
  viewer?: ViewerMessage; // → postToViewer (direct camera choreography)
  awaitFactors?: boolean; // pause here: show the factor poll, then play resume(factors)
  resume?: (factors: ClinicalFactors) => Beat[]; // factor-dependent continuation (compute + verdict)
}

type MkId = (p: string) => string;

/**
 * HERO_sub013 data-derived score inputs (leak-safe — points/labels, never raw age).
 * age 60 → PHASES age band "<=70" (+0), ELAPSS age "<=60" (+0). Lets the client compute
 * the same PHASES/ELAPSS the server tool would, from the clinician's answered factors.
 */
export const HERO_DATA_INPUTS: ScoreDataInputs = {
  caseId: "HERO_sub013",
  maxDiameterMm: 6.156,
  location: "other",
  phasesAgePts: 0,
  ageBandLabel: "<=70",
  ageAssumed: false,
  elapssAgePts: 0,
  elapssAgeLabel: "<=60",
  datasetReference: null,
};

// ── helpers ──────────────────────────────────────────────────────────────────

/** Global pacing multiplier for the reasoning content (typing + tool latency). Stretches the
 *  run to ~22s so it reads as deliberate. Only scales `stream`/`tool` delays — NOT the `wait()`
 *  camera/hold beats, which are literal relative gaps glued to their neighboring beats. */
const PACE = 2.1;

/** Split prose into word-chunk beats → a live typing effect via `thinking`/`text` deltas. */
function stream(text: string, type: "thinking" | "text", opts: { delay?: number; lead?: number } = {}): Beat[] {
  const delay = opts.delay ?? 24;
  const words = text.match(/\S+\s*/g) ?? [text];
  return words.map((w, i) => ({
    delayMs: Math.round((i === 0 ? (opts.lead ?? 140) : delay) * PACE),
    event: { type, text: w },
  }));
}

/** tool_call → (running gap) → tool_result ok, sharing one id (reducer matches by id). */
function tool(
  mkId: MkId,
  name: string,
  input: Record<string, unknown>,
  result: unknown,
  summary: string,
  opts: { runningMs?: number; leadMs?: number } = {},
): Beat[] {
  const id = mkId("t");
  const runningMs = Math.round((opts.runningMs ?? 480) * PACE);
  return [
    { delayMs: Math.round((opts.leadMs ?? 160) * PACE), event: { type: "tool_call", id, name, input } },
    {
      delayMs: runningMs,
      event: { type: "tool_result", id, name, status: "ok", durationMs: runningMs, summary, result },
    },
  ];
}

const wait = (delayMs: number, viewer: ViewerMessage): Beat => ({ delayMs, viewer });

// ── citations (real-corpus-shaped, honest CFD framing) ────────────────────────

const CITES: Record<string, Citation> = {
  nat_hist: {
    id: "unruptured_natural-hist-01",
    title: "Natural history of small unruptured intracranial aneurysms (<7 mm)",
    citation: "ISUIA / UCAS pooled, 2003–2012",
    year: 2012,
    passage:
      "Anterior-circulation unruptured aneurysms <7 mm carry a low single-digit cumulative rupture rate over 5 years.",
    topic: "natural-history",
    direction: "size<7mm → rupture↓",
    evidence: "prospective cohort, n>5000",
    contested: false,
    relevanceScore: 0.91,
    stance: "neutral",
  },
  size_ar: {
    id: "morph_size-ar-02",
    title: "Aspect ratio and size as discriminators of aneurysm rupture status",
    citation: "Dhar et al., Neurosurgery 2008",
    year: 2008,
    passage: "Rupture risk rises steeply once aspect ratio exceeds ~1.6; AR near 1.0 tracks with unruptured status.",
    topic: "morphology",
    direction: "AR↑ → rupture↑",
    evidence: "case-control, n=45",
    contested: false,
    relevanceScore: 0.9,
    stance: "neutral",
  },
  size_ratio: {
    id: "morph_size-ratio-04",
    title: "Size ratio as a combined morphologic–hemodynamic rupture predictor",
    citation: "Jou et al., AJNR 2010 (ICA-specific)",
    year: 2010,
    passage: "Elevated size ratio (parent-vessel-normalized) associates with rupture, but the cohort is ICA-specific.",
    topic: "morphology",
    direction: "size-ratio↑ → rupture↑",
    evidence: "CFD + morphometrics, ICA cohort",
    contested: false,
    relevanceScore: 0.78,
    stance: "neutral",
  },
  wss_high: {
    id: "hemodynamics_wss-high-05",
    title: "High focal wall shear stress at the neck and aneurysm rupture",
    citation: "Cebral et al., AJNR 2011",
    year: 2011,
    passage: "Concentrated high-WSS inflow jets at the neck associate with rupture in patient-specific CFD.",
    topic: "wss",
    direction: "high-WSS → rupture↑",
    evidence: "CFD case series (contested)",
    contested: true,
    relevanceScore: 0.84,
    stance: "high-wss",
  },
  wss_low: {
    id: "hemodynamics_lowshear-osi-03",
    title: "Low wall shear stress with high OSI in the dome and rupture",
    citation: "Xiang et al., Stroke 2011",
    year: 2011,
    passage:
      "Low-WSS, high-OSI dome regions correlate with wall degeneration and rupture — opposing the high-WSS hypothesis.",
    topic: "wss",
    direction: "low-WSS+OSI↑ → rupture↑",
    evidence: "CFD case-control (contested)",
    contested: true,
    relevanceScore: 0.83,
    stance: "low-wss",
  },
  neck_coiling: {
    id: "treatment_wide-neck-06",
    title: "Wide-neck geometry and endovascular coiling durability",
    citation: "Raymond et al., Stroke 2003",
    year: 2003,
    passage: "A wide neck and low dome-to-neck ratio predict incomplete occlusion and recurrence after coiling.",
    topic: "treatment",
    direction: "wide-neck → coiling durability↓",
    evidence: "prospective series",
    contested: false,
    relevanceScore: 0.72,
    stance: "neutral",
  },
};
const cite = (...ids: (keyof typeof CITES)[]) => ids.map((k) => CITES[k]);

// Shared morphology payload (an `ok` result on get_morphology triggers directorHandle focus).
const MORPH = {
  maxDiameterMm: 6.156,
  neckWidthMm: 6.153,
  heightMm: 6.542,
  aspectRatio: 1.063,
  sizeRatio: 2.069,
  peakWssPa: 6.942,
  osiMax: 0.3,
  lowShearAreaFraction: 0.203,
  location: "other",
  provenanceTier: "3-analytic-proxy",
};

// get_morphology's real (nested) return shape — so the chart note reads it like a live case.
const MORPH_RESULT = {
  caseId: "HERO_sub013",
  location: MORPH.location,
  geometry: {
    maxDiameterMm: MORPH.maxDiameterMm,
    domeHeightMm: MORPH.heightMm,
    neckWidthMm: MORPH.neckWidthMm,
    aspectRatio: MORPH.aspectRatio,
    sizeRatio: MORPH.sizeRatio,
  },
  hemodynamics: {
    peakWssPa: MORPH.peakWssPa,
    meanWssPa: 4.447,
    osiMax: MORPH.osiMax,
    lowShearAreaFraction: MORPH.lowShearAreaFraction,
    provenanceTier: MORPH.provenanceTier,
    provenanceNote: "Poiseuille WSS from vessel radii — NOT a transient CFD solve.",
  },
};

const RUPTURE_RISK: RiskAssessment = {
  level: "low",
  headline:
    "Low estimated rupture risk on geometry and natural-history grounds — but the hemodynamic evidence is contested and proxy-derived, so treat this as decision support, not a verdict.",
  confidence: "moderate",
  reasoningSteps: [
    "Computed PHASES = 4 → 0.9% 5-year rupture risk — a low baseline, but the score is blind to shape/WSS and a low PHASES is not reassurance on its own [rupture_risk_scores-06].",
    "Max diameter 6.16 mm sits just under the 7 mm ISUIA/UCAS threshold for elevated risk.",
    "Aspect ratio 1.06 is well below the ~1.6 instability band; size ratio 2.07 is the one mildly elevated shape metric.",
    "Peak WSS 6.94 Pa and OSI 0.3 come from a Tier-3 analytic proxy, not a transient patient-specific CFD solve.",
    "The WSS↔rupture link is contested; this case shows both the high-neck-WSS and low-dome-WSS signatures, so hemodynamics is non-discriminating here.",
    "Natural-history data for small unruptured anterior-circulation aneurysms anchors the estimate low.",
  ],
  whatWouldChangeMyMind: [
    "A transient patient-specific CFD solve confirming a sustained high-focal neck-WSS jet.",
    "Documented interval growth on follow-up imaging.",
    "An increase in aspect ratio or size ratio over time.",
    "Symptomatic or sentinel-bleed presentation.",
    "Patient factors: smoking, hypertension, or family history of subarachnoid hemorrhage.",
  ],
  citationIds: [
    "unruptured_natural-hist-01",
    "morph_size-ar-02",
    "hemodynamics_wss-high-05",
    "hemodynamics_lowshear-osi-03",
  ],
  contested: true,
};

// ── the four canonical runs ───────────────────────────────────────────────────

/** Human-readable note of which entered factors lifted PHASES above the baseline. */
function factorNote(factors: ClinicalFactors): string {
  const bumps: string[] = [];
  if (factors.population === "finnish") bumps.push("Finnish population +5");
  else if (factors.population === "japanese") bumps.push("Japanese population +3");
  if (factors.hypertension) bumps.push("hypertension +1");
  if (factors.earlierSAH) bumps.push("earlier SAH +1");
  return bumps.join(", ");
}

/**
 * Post-poll continuation: compute PHASES/ELAPSS from the clinician's factors, then
 * deliver a verdict whose LEVEL adapts to the computed % — so the demo stays honest
 * for any factor choice (no "LOW" beside a PHASES 11 → 7.2%). Geometry stays the
 * anchor; the score and morphology are allowed to pull apart.
 */
function resumeRupture(factors: ClinicalFactors, mkId: MkId): Beat[] {
  const scores = scorePhasesElapss(HERO_DATA_INPUTS, factors, true);
  const total = scores.phases.total;
  const pct = scores.phases.fiveYearRuptureRiskPct;
  const bumps = factorNote(factors);
  const level: RiskAssessment["level"] = pct < 1 ? "low" : pct <= 3 ? "moderate" : "high";

  const headline =
    level === "low"
      ? "Low estimated rupture risk — geometry is reassuring and PHASES is low; the hemodynamic evidence is contested and proxy-derived, so treat this as decision support, not a verdict."
      : level === "moderate"
        ? `Low-to-moderate: the geometry is reassuring, but the factors you entered lift PHASES to ${total} → ${pct}% 5-yr. Hemodynamics is contested and proxy-derived, so this stays decision support.`
        : `Elevated: PHASES is ${total} → ${pct}% 5-yr, driven by the factors you entered${bumps ? ` (${bumps})` : ""}, though the geometry itself is reassuring — that tension is exactly why this is decision support, not a verdict.`;

  const phasesStep =
    level === "low"
      ? `Computed PHASES = ${total} → ${pct}% 5-year rupture risk from the factors you entered — a low baseline, but blind to shape/WSS and a low PHASES is not reassurance on its own [rupture_risk_scores-01, rupture_risk_scores-06].`
      : `Computed PHASES = ${total} → ${pct}% 5-year rupture risk — raised by the factors you entered${bumps ? ` (${bumps})` : ""}; the score is still blind to shape and WSS [rupture_risk_scores-01].`;

  const verdictProse =
    level === "low"
      ? `Bottom line: for this aneurysm I read rupture risk as **low**, with **moderate** confidence. Geometry is reassuring — 6.16 mm, aspect ratio 1.06, below the 7 mm and ~1.6 AR thresholds — and the factors you entered keep PHASES at ${total} → ${pct}% 5-yr. Hemodynamics is a Tier-3 proxy and the WSS↔rupture link is **contested** (this case shows both signatures), so I would not treat it as decisive.`
      : `Bottom line: the geometry here is reassuring — 6.16 mm, aspect ratio 1.06, below the usual thresholds — but the factors you entered push **PHASES to ${total} → ${pct}% 5-yr**, so I read this as **${level}**, with **moderate** confidence. Hemodynamics stays a contested Tier-3 proxy and isn't decisive either way. This is exactly the kind of case where the validated score and the morphology pull apart — decision support, not a verdict.`;

  const risk: RiskAssessment = {
    level,
    headline,
    confidence: "moderate",
    reasoningSteps: [
      phasesStep,
      "Max diameter 6.16 mm sits just under the 7 mm ISUIA/UCAS threshold; aspect ratio 1.06 is well below the ~1.6 instability band (size ratio 2.07 the one mildly elevated shape metric).",
      "Peak WSS 6.94 Pa and OSI 0.3 are a Tier-3 analytic proxy, not a transient CFD solve, and the WSS↔rupture link is contested — this case shows both signatures, so hemodynamics is non-discriminating here.",
      "Natural-history data for small unruptured anterior-circulation aneurysms anchors the baseline low.",
    ],
    whatWouldChangeMyMind: [
      "Documented interval growth on follow-up imaging.",
      "A transient patient-specific CFD solve confirming a sustained high-focal neck-WSS jet.",
      "An increase in aspect ratio or size ratio over time.",
    ],
    citationIds: [
      "rupture_risk_scores-01",
      "unruptured_natural-hist-01",
      "morph_size-ar-02",
      "hemodynamics_wss-high-05",
      "hemodynamics_lowshear-osi-03",
    ],
    contested: true,
  };

  return [
    ...tool(
      mkId,
      "compute_risk_scores",
      { caseId: "HERO_sub013", factors },
      scores,
      `PHASES ${total} -> ${pct}% 5-yr, ELAPSS ${scores.elapss.total}/40 (${scores.elapss.growthRiskBand})`,
      { runningMs: 420 },
    ),
    ...stream(
      `With the factors you entered, PHASES computes to ${total} → ${pct}% 5-year risk. Folding that into the geometry and the contested hemodynamics now. `,
      "thinking",
    ),
    ...stream(verdictProse, "text", { delay: 15, lead: 260 }),
    { delayMs: 240, event: { type: "risk", risk } },
    {
      delayMs: 180,
      event: { type: "sources", sources: cite("nat_hist", "size_ar", "size_ratio", "wss_high", "wss_low", "neck_coiling") },
    },
    { delayMs: 160, event: { type: "done" } },
    wait(3000, { type: "settle" }), // hold on the verdict ~3s, then fly OUT to the default view + rotate
  ];
}

/** "Will this aneurysm rupture?" — reason first, then ask the factors, then the verdict. */
function ruptureRun(mkId: MkId): Beat[] {
  return [
    ...stream("First I need to find the aneurysm itself — let me isolate the sac where the wall bulges out beyond the vessel. ", "thinking"),
    wait(200, { type: "findSac" }), // play the detection sequence, then reason over what it found
    ...stream("Now I'll read this patient's morphology — shape is the sturdier signal, so I anchor there before hemodynamics. ", "thinking"),
    ...tool(mkId, "get_morphology", { caseId: "HERO_sub013" }, MORPH_RESULT, "other · 6.156 mm · AR 1.063 · LSAF 20.3%", {
      runningMs: 360,
    }),
    ...stream("6.16 mm sits just under the 7 mm ISUIA/UCAS line, and AR 1.06 is far below the ~1.6 instability band. Size ratio 2.07 is the only mildly elevated metric. Let me check the literature on size and shape first. ", "thinking"),
    ...tool(
      mkId,
      "query_literature",
      { query: "rupture risk for 5-6mm unruptured aneurysm natural history", topic: "morphology" },
      { sources: cite("nat_hist", "size_ar"), mode: "semantic" },
      "5 sources (2 contested) via semantic",
    ),
    ...tool(
      mkId,
      "query_literature",
      { query: "elevated size ratio ~2 association with aneurysm rupture", topic: "morphology" },
      { sources: cite("size_ratio"), mode: "semantic" },
      "5 sources (2 contested) via semantic",
    ),
    ...stream("Now the contested part — wall shear stress. I'll pull the hemodynamic evidence and put the field on screen. ", "thinking"),
    // ── active choreography chunk begins: orbit + zoom while examining the flow ──
    wait(120, { type: "setThinking", on: true }),
    wait(260, { type: "focusAneurysm" }),
    ...tool(
      mkId,
      "query_literature",
      { query: "low wall shear stress and low-shear area fraction association with rupture", topic: "wss", applies_to: "wss" },
      { sources: cite("wss_low", "wss_high"), mode: "semantic" },
      "5 sources (4 contested) via semantic",
      { runningMs: 620 },
    ),
    ...tool(
      mkId,
      "query_literature",
      { query: "wide neck dome-to-neck ratio unfavourable for coiling treatment", topic: "treatment" },
      { sources: cite("neck_coiling"), mode: "semantic" },
      "1 sources (0 contested) via semantic",
    ),
    ...stream("It's located outside the ICA proper (Jou's size-ratio work is ICA-specific), measures 6.16 mm with a 5–6 mm neck, and carries an elevated size ratio of 2.069. The low-shear area fraction of 20.3% and AR 1.06 read as mechanically inert for rupture — but the wide 6.15 mm neck with minimal dome-to-neck distance is unfavorable geometry for endovascular coiling. ", "thinking"),
    ...tool(
      mkId,
      "highlight_geometry",
      { elementIds: ["neck", "aneurysm_dome"], mode: "hemodynamics" },
      { mode: "hemodynamics", elementIds: ["neck", "aneurysm_dome"] },
      "neck inflow + dome recirculation highlighted",
      { runningMs: 320 },
    ),
    ...stream("Geometry read and flow examined. Before I commit to a PHASES/ELAPSS score, I need four clinical factors the scan can't give me — let me ask. ", "thinking"),
    wait(120, { type: "setThinking", on: false }),
    // ── pause: show the factor poll, then resume with compute + adaptive verdict ──
    { delayMs: Math.round(220 * PACE), awaitFactors: true, resume: (factors) => resumeRupture(factors, mkId) },
  ];
}

/** "Why? Show me the flow." — explain the mechanism, reveal WSS + streamlines. */
function flowRun(mkId: MkId): Beat[] {
  return [
    ...stream("You want the mechanism, not just the verdict — let me pull the hemodynamic evidence and put the flow field on screen. ", "thinking"),
    wait(120, { type: "setThinking", on: true }),
    ...tool(
      mkId,
      "query_literature",
      { query: "inflow jet wall shear stress distribution neck versus dome aneurysm", topic: "wss", applies_to: "wss" },
      { sources: cite("wss_high", "wss_low"), mode: "semantic" },
      "5 sources (3 contested) via semantic",
      { runningMs: 600 },
    ),
    ...stream("The pattern here is a concentrated inflow jet striking the neck — that's the 6.94 Pa peak — then the flow slows and recirculates in the dome, leaving ~20% of the sac at low shear with OSI 0.3. Let me highlight both regions. ", "thinking"),
    wait(220, { type: "focusAneurysm" }),
    ...tool(
      mkId,
      "highlight_geometry",
      { elementIds: ["neck", "aneurysm_dome"], mode: "hemodynamics" },
      { mode: "hemodynamics", elementIds: ["neck", "aneurysm_dome"] },
      "neck inflow jet + dome recirculation highlighted",
      { runningMs: 340 },
    ),
    ...tool(
      mkId,
      "query_literature",
      { query: "low shear stress high OSI dome wall degeneration remodeling", topic: "wss", applies_to: "osi" },
      { sources: cite("wss_low"), mode: "semantic" },
      "3 sources (2 contested) via semantic",
    ),
    wait(120, { type: "setThinking", on: false }),
    ...stream(
      "Here's the mechanism you're seeing: the parent vessel drives a focused **inflow jet** into the neck (peak WSS **6.94 Pa**, the bright hotspot), then the stream decelerates and **recirculates** in the dome — that's the ~**20% low-shear** region at **OSI 0.3**. Both are implicated in rupture pathways, but by opposing theories: high focal neck WSS damages the wall in one camp, sustained low WSS + high OSI drives inflammatory remodeling in the other. Crucially this is a **Tier-3 analytic proxy** from the vessel radii, **not** a transient CFD solve — so read the field as suggestive of *where* stress concentrates, not as a calibrated rupture predictor.",
      "text",
      { delay: 15, lead: 300 },
    ),
    { delayMs: 200, event: { type: "sources", sources: cite("wss_high", "wss_low") } },
    { delayMs: 160, event: { type: "done" } },
    wait(3000, { type: "settle" }),
  ];
}

/** "What if the dome were 6 mm?" — perturb geometry, re-check thresholds. */
function whatIfRun(mkId: MkId): Beat[] {
  const after = { ...MORPH, maxDiameterMm: 6.0, aspectRatio: 1.04, sizeRatio: 2.01 };
  return [
    ...stream("Let me re-derive the shape metrics at a 6 mm dome and re-test them against the thresholds — note that re-shaping the geometry invalidates the baked hemodynamics, so WSS/OSI would need a fresh solve. ", "thinking"),
    ...tool(
      mkId,
      "perturb_morphology",
      { domeSizeMm: 6 },
      { before: { maxDiameterMm: MORPH.maxDiameterMm }, after },
      "dome → 6.0 mm · AR 1.06→1.04 · SR 2.07→2.01 · hemodynamics invalidated",
      { runningMs: 420 },
    ),
    wait(120, { type: "setThinking", on: true }),
    wait(240, { type: "focusAneurysm" }),
    ...stream("6.0 mm is marginally smaller than the current 6.16 — still comfortably sub-7 mm. Aspect ratio barely moves (1.06 → 1.04) and size ratio eases slightly (2.07 → 2.01). Nothing crosses a threshold. Let me confirm against the size literature. ", "thinking"),
    ...tool(
      mkId,
      "query_literature",
      { query: "aneurysm diameter threshold 7mm rupture risk small aneurysm", topic: "morphology" },
      { sources: cite("nat_hist", "size_ar"), mode: "semantic" },
      "5 sources (1 contested) via semantic",
    ),
    wait(120, { type: "setThinking", on: false }),
    ...stream(
      "At a 6 mm dome the picture is **essentially unchanged**: still below the 7 mm threshold, AR eases to 1.04, size ratio to 2.01 — every metric moves *toward* lower risk, not higher. So my read stays **low risk**. The important caveat: perturbing the dome **invalidates the baked WSS/OSI** (those were computed on the original geometry), so any hemodynamic claim at 6 mm would need a fresh proxy or CFD run — I won't carry the old flow numbers over.",
      "text",
      { delay: 15, lead: 300 },
    ),
    {
      delayMs: 240,
      event: {
        type: "risk",
        risk: {
          ...RUPTURE_RISK,
          headline: "Still low estimated risk at a 6 mm dome — every shape metric moves toward lower risk; hemodynamics would need re-solving.",
        },
      },
    },
    { delayMs: 180, event: { type: "sources", sources: cite("nat_hist", "size_ar") } },
    { delayMs: 160, event: { type: "done" } },
    wait(3000, { type: "settle" }),
  ];
}

/**
 * "How would you get a catheter there?" — trace a route over the centerline graph.
 * The `find_catheter_path` tool_result triggers the viewer's animated `findCatheter`
 * search (wide wavefront → converge → gold route reveal), which owns the camera — so this
 * run stays out of its way: no setThinking / focus / settle beats here.
 */
function catheterRun(mkId: MkId): Beat[] {
  return [
    ...stream("Endovascular access — let me trace the shortest feasible route from the arterial entry to the aneurysm neck over this patient's centerline graph. ", "thinking"),
    ...tool(
      mkId,
      "find_catheter_path",
      { from: "entry", to: "aneurysm" },
      { feasible: true, routes: [{ length_mm: 67.8, n_hops: 7 }] },
      "feasible · ~68 mm traced · 7 hops from entry to neck",
      { runningMs: 520 },
    ),
    ...stream("Watch the search fan out from the entry node across the vasculature, then converge on the shortest path to the neck — up the parent vessel over about seven segments, sac distal. Navigable, but the bends want a shaped microcatheter tip. ", "thinking", { lead: 420 }),
    ...stream(
      "Access looks **feasible**. The traced centerline route is ~**68 mm** from the entry to the neck across **7 hops** — navigable with a standard microcatheter/microwire, though the bends call for a shaped tip. The catch is the **target**, not the path: the **wide 6.15 mm neck** and minimal dome-to-neck distance make a stable coil basket hard to retain, so this geometry likely wants **balloon- or stent-assisted** coiling (or flow diversion) rather than bare coiling. The gold path on the model is graph-derived from the centerline, not a validated navigation plan.",
      "text",
      { delay: 15, lead: 300 },
    ),
    { delayMs: 200, event: { type: "sources", sources: cite("neck_coiling") } },
    { delayMs: 160, event: { type: "done" } },
  ];
}

/** Pick the run matching the question; free-typed input falls back to the rupture verdict. */
export function buildHeroRun(question: string, mkId: MkId): Beat[] {
  const q = question.toLowerCase();
  if (/catheter|get .*there|navigat|access|coil|treat|endovascular/.test(q)) return catheterRun(mkId);
  if (/dome|\bmm\b|what if|perturb|bigger|larger|smaller|grow/.test(q)) return whatIfRun(mkId);
  if (/\bflow\b|why|shear|wss|hemodynam|osi|jet/.test(q)) return flowRun(mkId);
  return ruptureRun(mkId); // rupture / risk / anything else → the flagship verdict
}
