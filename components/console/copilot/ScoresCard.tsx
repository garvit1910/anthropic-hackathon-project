"use client";

import type { RiskScores, ScoreComponent } from "@/lib/agent/types";

/**
 * ScoresCard — the computed validated instruments (PHASES + ELAPSS), shown as an
 * auditable point ledger, not a quote. Numbers come straight from compute_risk_scores
 * (tool-authoritative); this file is presentation only. Assumed inputs are flagged so a
 * clinician can see exactly what the score did and did not know.
 */

// 5-yr rupture-risk % → a risk colour (mirrors RiskCard's LOW/MODERATE/HIGH palette).
function riskColor(pct: number): string {
  if (pct < 1) return "#2b6cff";
  if (pct <= 3) return "#7f5bff";
  return "#ff3300";
}
const BAND_COLOR: Record<string, string> = {
  low: "#2b6cff",
  moderate: "#7f5bff",
  high: "#ff3300",
};

function PointChip({ points }: { points: number }) {
  return (
    <span
      className="num shrink-0 rounded px-1.5 py-0.5 text-[10px] tabular-nums"
      style={{
        color: points > 0 ? "#e7ecf5" : "#7d8fa8",
        background: points > 0 ? "rgba(127,91,255,0.16)" : "rgba(255,255,255,0.05)",
      }}
    >
      +{points}
    </span>
  );
}

function Ledger({ components }: { components: ScoreComponent[] }) {
  return (
    <ol className="mt-2 space-y-1">
      {components.map((c, i) => (
        <li key={i} className="flex items-center gap-2 text-[11px] leading-tight">
          <span className="num w-3.5 shrink-0 text-center text-text-lo/50">{c.key}</span>
          <span className="w-20 shrink-0 text-text-hi/90">{c.name}</span>
          <span className="min-w-0 flex-1 truncate text-text-lo/80" title={c.value}>
            {c.value}
          </span>
          {c.assumed && (
            <span className="num shrink-0 rounded-full border border-white/10 px-1.5 py-px text-[9px] uppercase tracking-wide text-text-lo/60">
              assumed
            </span>
          )}
          <PointChip points={c.points} />
        </li>
      ))}
    </ol>
  );
}

export default function ScoresCard({ scores }: { scores: RiskScores }) {
  const { phases, elapss, datasetReference } = scores;
  const pColor = riskColor(phases.fiveYearRuptureRiskPct);
  const gaugeFill = Math.max(0.06, Math.min(1, phases.fiveYearRuptureRiskPct / 10)); // 10% caps the bar

  return (
    <div className="glass rounded-lg border-l-2 p-3.5" style={{ borderLeftColor: pColor }}>
      <div className="flex items-baseline justify-between">
        <span className="num text-[10px] uppercase tracking-widest text-text-lo">validated scores · computed</span>
        <span className="num text-[10px] text-text-lo/70">this patient</span>
      </div>

      {/* PHASES */}
      <div className="mt-2.5">
        <div className="flex items-baseline justify-between">
          <span className="display text-sm font-bold tracking-wide text-text-hi">PHASES</span>
          <span className="text-[11px] text-text-lo">
            <span className="display text-base font-bold tabular-nums" style={{ color: pColor }}>
              {phases.fiveYearRuptureRiskPct}%
            </span>{" "}
            5-yr rupture
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.round(gaugeFill * 100)}%`, background: pColor, boxShadow: `0 0 12px ${pColor}` }}
          />
        </div>
        <div className="num mt-1 text-[10px] text-text-lo/70">
          total {phases.total} pts · baseline only — blind to shape, WSS &amp; irregularity
        </div>

        <Ledger components={phases.components} />

        {phases.assumptions.length > 0 ? (
          <div className="mt-2 border-t border-white/5 pt-2">
            <div className="num mb-1 text-[10px] uppercase tracking-widest text-text-lo/80">
              assumed inputs — sensitivity
            </div>
            <ul className="space-y-0.5">
              {phases.assumptions.map((a, i) => (
                <li key={i} className="flex gap-1.5 text-[10.5px] leading-snug text-text-lo/75">
                  <span className="shrink-0 text-text-lo/45">→</span>
                  <span>
                    <span className="text-text-hi/80">{a.field}</span> {a.assumedValue}; {a.ifPresent}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="num mt-2 border-t border-white/5 pt-2 text-[10px] text-text-lo/65">
            ✓ population, hypertension, earlier SAH &amp; shape entered by the clinician
          </div>
        )}
      </div>

      {/* ELAPSS */}
      <div className="mt-3 border-t border-white/5 pt-2.5">
        <div className="flex items-baseline justify-between">
          <span className="display text-sm font-bold tracking-wide text-text-hi">ELAPSS</span>
          <span className="flex items-center gap-1.5 text-[11px] text-text-lo">
            <span className="num tabular-nums text-text-hi/90">
              {elapss.total}/{elapss.maxPoints}
            </span>
            <span
              className="num rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide"
              style={{ color: BAND_COLOR[elapss.growthRiskBand], background: `${BAND_COLOR[elapss.growthRiskBand]}22` }}
            >
              {elapss.growthRiskBand} growth
            </span>
          </span>
        </div>
        <Ledger components={elapss.components} />
        <p className="mt-1.5 text-[10px] leading-snug text-text-lo/60">{elapss.note}</p>
      </div>

      {/* Provenance + honest dataset cross-reference */}
      <div className="mt-2.5 border-t border-white/5 pt-2 text-[10px] leading-snug text-text-lo/70">
        <div>
          <span className="num text-accent">{phases.citationId}</span> {phases.instrument} ·{" "}
          <span className="num text-accent">{elapss.citationId}</span> {elapss.instrument}
        </div>
        {datasetReference && (
          <div className="mt-1.5 rounded border border-white/8 bg-white/[0.03] px-2 py-1.5">
            <span className="num uppercase tracking-wide text-text-lo/60">dataset reference</span>{" "}
            PHASE {datasetReference.phase ?? "—"} / ELAPSS {datasetReference.elapss ?? "—"} —{" "}
            {datasetReference.note}
          </div>
        )}
      </div>
    </div>
  );
}
