"use client";

import type { CaseMeta } from "@/types";

/**
 * Placeholder for the streaming Copilot chat + tool-trace UI (a later
 * delivery). Shows the four canonical demo questions so the panel reads as
 * real, with the agent loop wired in the next build.
 */
const CANONICAL_QUESTIONS = [
  "Will this aneurysm rupture?",
  "Why? Show me the flow.",
  "What if the dome were 6 mm?",
  "How would you get a catheter there?",
];

export default function CopilotPanelPlaceholder({ caseMeta }: { caseMeta: CaseMeta }) {
  return (
    <aside className="glass flex min-h-0 flex-col border-t border-white/5 lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent shadow-glow" />
          <h2 className="display text-xs font-semibold tracking-widest text-text-hi">
            COPILOT
          </h2>
        </div>
        <span className="num text-[10px] text-text-lo">{caseMeta.id}</span>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-4 overflow-y-auto p-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-sm text-text-lo">
          The agent loop — streaming answers, live tool-call traces, structured
          risk cards, and contested-science flags — lands in the next build. The
          3D view is fully live now: switch modes and orbit the vasculature.
        </div>

        <div className="space-y-2">
          <p className="num text-[10px] uppercase tracking-widest text-text-lo">
            Try asking (soon)
          </p>
          {CANONICAL_QUESTIONS.map((q) => (
            <div
              key={q}
              className="cursor-not-allowed rounded-full border border-white/8 bg-white/[0.02] px-3.5 py-2 text-sm text-text-lo/80"
              title="Agent wiring coming in the next build"
            >
              {q}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.02] px-4 py-2.5 text-sm text-text-lo/60">
          Ask the copilot…
        </div>
      </div>
    </aside>
  );
}
