"use client";

import { useMemo, useState } from "react";
import type { Citation, RiskAssessment, RiskScores } from "@/lib/agent/types";

/**
 * ChartNote — an auto-generated, cited neurovascular-MDT note. Assembled entirely
 * CLIENT-SIDE from data the turn already produced (morphology + computed scores +
 * the risk verdict + retrieved sources). Deterministic (reliable on stage) and,
 * because it only reads leak-safe payloads, structurally cannot expose the outcome.
 * Turns the reasoning into a paste-into-the-record clinical artifact.
 */

interface MorphologyShape {
  caseId?: string;
  location?: string;
  geometry?: {
    maxDiameterMm?: number;
    domeHeightMm?: number;
    neckWidthMm?: number;
    aspectRatio?: number;
    sizeRatio?: number;
  };
  hemodynamics?: {
    peakWssPa?: number;
    osiMax?: number;
    provenanceTier?: string;
    provenanceNote?: string;
  };
}

function buildNote(opts: {
  caseId: string;
  morphology: MorphologyShape | null;
  scores: RiskScores | null;
  risk: RiskAssessment | null;
  sources: Citation[];
}): string {
  const { caseId, morphology, scores, risk, sources } = opts;
  const g = morphology?.geometry;
  const h = morphology?.hemodynamics;
  const L: string[] = [];

  L.push(`NEUROVASCULAR MDT NOTE — case ${caseId}`);
  L.push(`Decision support · clinician-in-the-loop · not a diagnostic device`);
  L.push("");

  L.push("LESION");
  if (g) {
    L.push(
      `  ${morphology?.location ?? "—"} aneurysm — ${g.maxDiameterMm ?? "—"} mm max diameter, ` +
        `neck ${g.neckWidthMm ?? "—"} mm, aspect ratio ${g.aspectRatio ?? "—"}, size ratio ${g.sizeRatio ?? "—"}.`,
    );
  } else {
    L.push("  (measurements unavailable)");
  }
  L.push("");

  if (scores) {
    L.push("VALIDATED SCORES (computed for this patient)");
    L.push(
      `  PHASES ${scores.phases.total} → ${scores.phases.fiveYearRuptureRiskPct}% 5-year rupture risk [${scores.phases.citationId}]`,
    );
    L.push(`    ${scores.phases.components.map((c) => `${c.name} +${c.points}${c.assumed ? "*" : ""}`).join(", ")}`);
    L.push(
      `    Assumed (*): ${scores.phases.assumptions.map((a) => `${a.field} ${a.assumedValue}`).join("; ")}.`,
    );
    L.push(
      `  ELAPSS ${scores.elapss.total}/${scores.elapss.maxPoints} → ${scores.elapss.growthRiskBand} growth risk (approx) [${scores.elapss.citationId}]`,
    );
    if (scores.datasetReference) {
      L.push(
        `  Dataset reference: PHASE ${scores.datasetReference.phase ?? "—"} / ELAPSS ${scores.datasetReference.elapss ?? "—"} (different scoring convention — provenance only, not a match).`,
      );
    }
    L.push("");
  }

  if (h && h.peakWssPa != null) {
    L.push("HEMODYNAMICS");
    L.push(`  Peak WSS ${h.peakWssPa} Pa, OSI(max) ${h.osiMax ?? "—"}.`);
    if (h.provenanceNote) L.push(`  Provenance: ${h.provenanceTier ?? "—"} — ${h.provenanceNote}`);
    L.push("");
  }

  if (risk) {
    L.push("ASSESSMENT");
    L.push(`  Risk level: ${risk.level.toUpperCase()} (confidence: ${risk.confidence}).`);
    L.push(`  ${risk.headline}`);
    if (risk.reasoningSteps?.length) {
      risk.reasoningSteps.forEach((s) => L.push(`    - ${s.replace(/^\d+\.\s*/, "")}`));
    }
    L.push("");
    if (risk.contested) {
      L.push("CAVEATS");
      L.push("  Judgment leans on contested science (e.g. the WSS↔rupture relationship).");
      L.push("  A low PHASES is not reassurance on its own [rupture_risk_scores-06].");
      L.push("");
    }
    if (risk.whatWouldChangeMyMind?.length) {
      L.push("WHAT WOULD CHANGE THIS");
      risk.whatWouldChangeMyMind.forEach((w) => L.push(`  - ${w}`));
      L.push("");
    }
  }

  if (sources?.length) {
    L.push("REFERENCES");
    sources.forEach((s) => L.push(`  [${s.id}] ${s.citation || s.title}`));
  }

  return L.join("\n").trimEnd();
}

export default function ChartNote(opts: {
  caseId: string;
  morphology: MorphologyShape | null;
  scores: RiskScores | null;
  risk: RiskAssessment | null;
  sources: Citation[];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const note = useMemo(() => buildNote(opts), [opts]);

  // Nothing worth a note without at least a verdict or the computed scores.
  if (!opts.risk && !opts.scores) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the note is still visible to select manually */
    }
  };

  return (
    <div className="glass rounded-lg p-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-left"
          aria-expanded={open}
        >
          <span className="num text-[10px] uppercase tracking-widest text-text-lo">
            {open ? "−" : "+"} MDT chart note
          </span>
          <span className="num text-[10px] text-text-lo/60">structured · cited · paste-ready</span>
        </button>
        <button
          onClick={copy}
          className="num rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-text-lo transition-colors hover:text-text-hi"
        >
          {copied ? "copied ✓" : "copy note"}
        </button>
      </div>

      {open && (
        <pre className="mt-2.5 max-h-80 overflow-auto whitespace-pre-wrap border-t border-white/5 pt-2.5 text-[11px] leading-relaxed text-text-lo/90">
          {note}
        </pre>
      )}
    </div>
  );
}
