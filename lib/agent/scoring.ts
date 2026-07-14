/**
 * scoring.ts — PURE PHASES/ELAPSS computation (no fs, no I/O).
 *
 * Extracted from tools.ts so BOTH the server tool (which reads morphology.json)
 * and the client (the scripted hero replay) can compute identical scores from a
 * clinician's answered factors. Keep this file dependency-free and browser-safe.
 *
 * PHASES weights + 5-yr risk table are exact (Greving 2014 / MDCalc). ELAPSS
 * component weights are Backes 2017 Table 1; its fine points->growth-% calibration
 * is not cleanly published, so we emit total/40 + a qualitative band. The four
 * factors we can't measure from a scan (population, hypertension, earlier SAH,
 * shape) come from the clinician via the poll; until answered they default to the
 * safe values and are flagged "assumed".
 */

import type { RiskScores, ScoreComponent } from "./types";

// ── the clinician-supplied factors (the poll) ────────────────────────────────

export type Population = "na_euro" | "japanese" | "finnish";
export type Shape = "regular" | "irregular";

export interface ClinicalFactors {
  population: Population;
  hypertension: boolean;
  earlierSAH: boolean;
  shape: Shape;
}

export const DEFAULT_FACTORS: ClinicalFactors = {
  population: "na_euro",
  hypertension: false,
  earlierSAH: false,
  shape: "regular",
};

/** The 4 poll questions (option values are plain strings; convert via the helpers). */
export const POLL_QUESTIONS = [
  {
    key: "population",
    label: "Population / ancestry",
    hint: "PHASES & ELAPSS weight geographic risk",
    options: [
      { value: "na_euro", label: "N. American / European" },
      { value: "japanese", label: "Japanese" },
      { value: "finnish", label: "Finnish" },
    ],
  },
  {
    key: "hypertension",
    label: "Hypertension",
    hint: "history of high blood pressure",
    options: [
      { value: "no", label: "No" },
      { value: "yes", label: "Yes" },
    ],
  },
  {
    key: "earlierSAH",
    label: "Earlier SAH",
    hint: "prior subarachnoid haemorrhage from another aneurysm",
    options: [
      { value: "no", label: "No" },
      { value: "yes", label: "Yes" },
    ],
  },
  {
    key: "shape",
    label: "Aneurysm shape",
    hint: "irregular / lobulated raises the ELAPSS growth score",
    options: [
      { value: "regular", label: "Regular" },
      { value: "irregular", label: "Irregular / lobulated" },
    ],
  },
] as const;

export function factorsFromSelections(sel: Record<string, string>): ClinicalFactors {
  const pop = sel.population === "japanese" || sel.population === "finnish" ? sel.population : "na_euro";
  return {
    population: pop as Population,
    hypertension: sel.hypertension === "yes",
    earlierSAH: sel.earlierSAH === "yes",
    shape: sel.shape === "irregular" ? "irregular" : "regular",
  };
}

export function selectionsFromFactors(f: ClinicalFactors): Record<string, string> {
  return {
    population: f.population,
    hypertension: f.hypertension ? "yes" : "no",
    earlierSAH: f.earlierSAH ? "yes" : "no",
    shape: f.shape,
  };
}

// ── the data-derived inputs (from morphology.json; NEVER the outcome label) ───

export interface ScoreDataInputs {
  caseId: string;
  maxDiameterMm: number;
  location: string;
  phasesAgePts: number;
  ageBandLabel: string; // ">70" | "<=70" | "unknown"
  ageAssumed: boolean; // true only when age is missing
  elapssAgePts: number;
  elapssAgeLabel: string; // e.g. "70-75" | "<=60" | "unknown"
  datasetReference: { phase: number | null; elapss: number | null; note: string } | null;
}

// ── exact tables (unchanged from the original inline implementation) ──────────

const PHASES_RISK_PCT: Record<number, number> = {
  0: 0.4, 1: 0.4, 2: 0.4, 3: 0.7, 4: 0.9, 5: 1.3,
  6: 1.7, 7: 2.4, 8: 3.2, 9: 4.3, 10: 5.3, 11: 7.2,
};
export function phasesRiskPct(total: number): number {
  if (total >= 12) return 17.8;
  if (total <= 2) return 0.4;
  return PHASES_RISK_PCT[total];
}

function phasesSitePoints(loc: string): number {
  const l = (loc || "").toUpperCase();
  if (l === "ICA") return 0;
  if (l === "MCA") return 2;
  return 4;
}
export function phasesSizePoints(mm: number): { points: number; band: string } {
  if (mm <= 7.0) return { points: 0, band: "<7.0 mm" };
  if (mm < 10) return { points: 3, band: "7.0-9.9 mm" };
  if (mm < 20) return { points: 6, band: "10-19.9 mm" };
  return { points: 10, band: ">=20 mm" };
}
function elapssLocationPoints(loc: string): { points: number; approx: boolean } {
  const l = (loc || "").toUpperCase();
  if (l === "ICA" || l === "ACA" || l === "ACOMM" || l === "ACOM") return { points: 0, approx: false };
  if (l === "MCA") return { points: 3, approx: false };
  if (l === "PCOMM" || l === "PCOM" || l === "BA" || l === "VA") return { points: 5, approx: false };
  return { points: 5, approx: true };
}
export function elapssSizePoints(mm: number): { points: number; band: string } {
  if (mm < 3) return { points: 0, band: "1.0-2.9 mm" };
  if (mm < 5) return { points: 4, band: "3.0-4.9 mm" };
  if (mm < 7) return { points: 10, band: "5.0-6.9 mm" };
  if (mm < 10) return { points: 13, band: "7.0-9.9 mm" };
  return { points: 22, band: ">=10 mm" };
}
export function elapssAgePoints(age: number): { points: number; band: string } {
  if (age <= 60) return { points: 0, band: "<=60" };
  const pts = Math.ceil((age - 60) / 5);
  const lo = 60 + (pts - 1) * 5 + 1;
  const hi = 60 + pts * 5;
  return { points: pts, band: `${lo}-${hi}` };
}

// ── factor → points (PHASES exact; ELAPSS population/SAH approximate, flagged) ─

const PHASES_POP_PTS: Record<Population, number> = { na_euro: 0, japanese: 3, finnish: 5 };
const ELAPSS_POP_PTS: Record<Population, number> = { na_euro: 0, japanese: 1, finnish: 7 };
const POP_LABEL: Record<Population, string> = {
  na_euro: "N. American / European",
  japanese: "Japanese",
  finnish: "Finnish",
};

// ── the assembler ────────────────────────────────────────────────────────────

/**
 * Compute PHASES + ELAPSS. When `userConfirmed` (the clinician answered the poll),
 * the four factor rows reflect their choices and carry NO "assumed" flag, and the
 * sensitivity list is empty. When false (no poll — the fallback), the output is
 * byte-identical to the original inline computeRiskScores with default factors.
 */
export function scorePhasesElapss(
  inputs: ScoreDataInputs,
  factors: ClinicalFactors,
  userConfirmed: boolean,
): RiskScores {
  const { maxDiameterMm: maxD, location } = inputs;
  const conf = userConfirmed;

  const sizeP = phasesSizePoints(maxD);
  const siteP = phasesSitePoints(location);
  const popPhasesPts = PHASES_POP_PTS[factors.population];
  const htnPts = factors.hypertension ? 1 : 0;
  const sahPhasesPts = factors.earlierSAH ? 1 : 0;

  const phasesComponents: ScoreComponent[] = [
    {
      key: "P",
      name: "Population",
      value: conf ? POP_LABEL[factors.population] : "N. American / European (assumed)",
      points: popPhasesPts,
      assumed: !conf,
    },
    {
      key: "H",
      name: "Hypertension",
      value: conf ? (factors.hypertension ? "present" : "absent") : "not recorded (assumed absent)",
      points: htnPts,
      assumed: !conf,
    },
    {
      key: "A",
      name: "Age",
      value: inputs.ageBandLabel !== "unknown" ? `${inputs.ageBandLabel} yrs` : "unknown",
      points: inputs.phasesAgePts,
      assumed: inputs.ageAssumed,
    },
    { key: "S", name: "Size", value: `${maxD} mm (${sizeP.band})`, points: sizeP.points, assumed: false },
    {
      key: "E",
      name: "Earlier SAH",
      value: conf ? (factors.earlierSAH ? "prior SAH from another aneurysm" : "none") : "not recorded (assumed none)",
      points: sahPhasesPts,
      assumed: !conf,
    },
    { key: "S", name: "Site", value: location, points: siteP, assumed: false },
  ];
  const phasesTotal = phasesComponents.reduce((s, c) => s + c.points, 0);
  const phasesPct = phasesRiskPct(phasesTotal);

  // Sensitivity is only meaningful while the factors are still assumed.
  const phasesAssumptions = conf
    ? []
    : [
        {
          field: "Hypertension",
          assumedValue: "absent (0 pts)",
          ifPresent: `+1 pt -> PHASES ${phasesTotal + 1} -> ${phasesRiskPct(phasesTotal + 1)}% 5-yr`,
        },
        {
          field: "Earlier SAH from another aneurysm",
          assumedValue: "none (0 pts)",
          ifPresent: `+1 pt -> PHASES ${phasesTotal + 1} -> ${phasesRiskPct(phasesTotal + 1)}% 5-yr`,
        },
        {
          field: "Population",
          assumedValue: "N. American / European (0 pts)",
          ifPresent: `Japanese +3 -> ${phasesRiskPct(phasesTotal + 3)}%, Finnish +5 -> ${phasesRiskPct(phasesTotal + 5)}% 5-yr`,
        },
      ];

  const eSize = elapssSizePoints(maxD);
  const eLoc = elapssLocationPoints(location);
  const popElapssPts = ELAPSS_POP_PTS[factors.population];
  const sahElapssPts = factors.earlierSAH ? 1 : 0;
  const shapePts = factors.shape === "irregular" ? 4 : 0;

  const elapssComponents: ScoreComponent[] = [
    {
      key: "E",
      name: "Earlier SAH",
      value: conf ? (factors.earlierSAH ? "prior SAH from another aneurysm" : "none") : "not recorded (assumed none)",
      points: sahElapssPts,
      assumed: !conf,
    },
    { key: "L", name: "Location", value: location, points: eLoc.points, assumed: eLoc.approx },
    {
      key: "A",
      name: "Age",
      value: inputs.elapssAgeLabel !== "unknown" ? `${inputs.elapssAgeLabel} yrs` : "unknown",
      points: inputs.elapssAgePts,
      assumed: inputs.ageAssumed,
    },
    {
      key: "P",
      name: "Population",
      value: conf ? POP_LABEL[factors.population] : "non-Finnish (assumed)",
      points: popElapssPts,
      assumed: !conf,
    },
    { key: "S", name: "Size", value: `${maxD} mm (${eSize.band})`, points: eSize.points, assumed: false },
    {
      key: "S",
      name: "Shape",
      value: conf ? (factors.shape === "irregular" ? "irregular / lobulated" : "regular") : "irregularity not assessed (assumed regular)",
      points: shapePts,
      assumed: !conf,
    },
  ];
  const elapssTotal = elapssComponents.reduce((s, c) => s + c.points, 0);
  const elapssBand = elapssTotal <= 5 ? "low" : elapssTotal <= 15 ? "moderate" : "high";

  return {
    caseId: inputs.caseId,
    inputsUsed: { maxDiameterMm: maxD, location, ageBand: inputs.ageBandLabel },
    phases: {
      total: phasesTotal,
      fiveYearRuptureRiskPct: phasesPct,
      riskLabel: `${phasesPct}% 5-year rupture risk`,
      components: phasesComponents,
      assumptions: phasesAssumptions,
      citationId: "rupture_risk_scores-01",
      instrument: "PHASES (Greving et al. 2014, Lancet Neurol)",
    },
    elapss: {
      total: elapssTotal,
      maxPoints: 40,
      growthRiskBand: elapssBand,
      components: elapssComponents,
      note:
        "ELAPSS predicts aneurysm GROWTH, not rupture. Component points follow Backes 2017; the growth-risk " +
        "band is an approximation (the fine per-point growth-% table is not used). Treat as a companion to PHASES.",
      citationId: "rupture_risk_scores-05",
      instrument: "ELAPSS (Backes et al. 2017, Neurology)",
    },
    datasetReference: inputs.datasetReference,
    citationIds: ["rupture_risk_scores-01", "rupture_risk_scores-05", "rupture_risk_scores-06"],
    _note: conf
      ? "Computed live from THIS patient's size, location and age band, plus the clinician-entered factors " +
        "(population, hypertension, earlier SAH, shape). The rupture outcome label is not read. A low PHASES is " +
        "not reassurance on its own (rupture_risk_scores-06)."
      : "Computed live from THIS patient's size, location and age band. The rupture outcome label is not read. " +
        "Unknown inputs (population, hypertension, earlier SAH, aneurysm shape) are DEFAULTED and FLAGGED with " +
        "their sensitivity in `assumptions` — surface them. A low PHASES is not reassurance on its own " +
        "(rupture_risk_scores-06).",
  };
}
