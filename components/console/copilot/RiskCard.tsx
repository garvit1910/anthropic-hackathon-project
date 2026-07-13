"use client";

import { useState } from "react";
import type { Citation, RiskAssessment, RiskLevel } from "@/lib/agent/types";

const LEVEL: Record<RiskLevel, { label: string; color: string; fill: number }> = {
  low: { label: "LOW", color: "#2b6cff", fill: 0.26 },
  moderate: { label: "MODERATE", color: "#7f5bff", fill: 0.56 },
  high: { label: "HIGH", color: "#ff3300", fill: 0.9 },
  indeterminate: { label: "INDETERMINATE", color: "#7d8fa8", fill: 0.5 },
};

function Gauge({ level }: { level: RiskLevel }) {
  const l = LEVEL[level] ?? LEVEL.indeterminate;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="num text-[10px] uppercase tracking-widest text-text-lo">rupture-risk read</span>
        <span className="display text-sm font-bold tracking-wide" style={{ color: l.color }}>
          {l.label}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.round(l.fill * 100)}%`, background: l.color, boxShadow: `0 0 12px ${l.color}` }}
        />
      </div>
    </div>
  );
}

function EvidenceChips({ ids, sources }: { ids: string[]; sources: Citation[] }) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const cited = ids.map((id) => byId.get(id)).filter(Boolean) as Citation[];
  const list = cited.length ? cited : sources;
  const [open, setOpen] = useState(false);
  if (!list.length) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="num flex items-center gap-1 text-[10px] uppercase tracking-widest text-text-lo hover:text-text-hi"
      >
        {list.length} citation{list.length === 1 ? "" : "s"} {open ? "−" : "+"}
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {list.map((s) => (
            <li key={s.id} className="rounded border border-white/6 bg-white/[0.02] px-2 py-1">
              <div className="flex items-center gap-1.5">
                <span className="num text-[10px] text-accent">{s.id}</span>
                {s.contested && (
                  <span className="num rounded-sm bg-wss-high/15 px-1 text-[9px] text-wss-high">contested</span>
                )}
                {s.stance && s.stance !== "neutral" && (
                  <span className="num text-[9px] text-text-lo">{s.stance}</span>
                )}
              </div>
              <div className="mt-0.5 text-[10.5px] leading-snug text-text-lo">{s.title}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The structured verdict — a card, not prose. */
export default function RiskCard({ risk, sources }: { risk: RiskAssessment; sources: Citation[] }) {
  const l = LEVEL[risk.level] ?? LEVEL.indeterminate;
  return (
    <div className="glass rounded-lg border-l-2 p-3.5" style={{ borderLeftColor: l.color }}>
      <Gauge level={risk.level} />

      <p className="mt-2.5 text-[13px] leading-snug text-text-hi">{risk.headline}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="num rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-text-lo">
          confidence: <span className="text-text-hi">{risk.confidence}</span>
        </span>
        {risk.contested && (
          <span
            className="num rounded-full border border-wss-high/30 bg-wss-high/10 px-2 py-0.5 text-[10px] text-wss-high"
            title="This judgment rests on disputed science (e.g. the WSS↔rupture relationship)."
          >
            ⚑ contested science
          </span>
        )}
      </div>

      {risk.reasoningSteps?.length > 0 && (
        <ol className="mt-3 space-y-1.5 border-t border-white/5 pt-2.5">
          {risk.reasoningSteps.map((step, i) => (
            <li key={i} className="flex gap-2 text-[11.5px] leading-snug text-text-lo/90">
              <span className="num shrink-0 text-accent">{i + 1}</span>
              <span>{step.replace(/^\d+\.\s*/, "")}</span>
            </li>
          ))}
        </ol>
      )}

      {risk.whatWouldChangeMyMind?.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-2.5">
          <div className="num mb-1 text-[10px] uppercase tracking-widest text-text-lo">What would change this</div>
          <ul className="space-y-1">
            {risk.whatWouldChangeMyMind.map((w, i) => (
              <li key={i} className="flex gap-2 text-[11px] leading-snug text-text-lo/85">
                <span className="shrink-0 text-text-lo/50">→</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-2.5">
          <EvidenceChips ids={risk.citationIds ?? []} sources={sources} />
        </div>
      )}
    </div>
  );
}
