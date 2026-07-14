"use client";

import type { CopilotToolTrace } from "./useAgentStream";

const TOOL_LABEL: Record<string, string> = {
  get_morphology: "read morphology",
  query_literature: "query literature",
  find_catheter_path: "trace catheter path",
  perturb_morphology: "perturb geometry",
  highlight_geometry: "highlight anatomy",
};

/** The most informative single line of a tool's input. */
function inputSummary(name: string, input: Record<string, unknown>): string | null {
  if (name === "query_literature") {
    const q = String(input.query ?? "").trim();
    return q ? `“${q.length > 68 ? q.slice(0, 68) + "…" : q}”` : null;
  }
  if (name === "perturb_morphology") {
    const parts: string[] = [];
    if (input.domeSizeMm != null) parts.push(`dome ${input.domeSizeMm} mm`);
    if (input.neckWidthMm != null) parts.push(`neck ${input.neckWidthMm} mm`);
    return parts.join(" · ") || null;
  }
  if (name === "highlight_geometry") {
    const ids = Array.isArray(input.elementIds) ? (input.elementIds as string[]) : [];
    return ids.join(", ") || null;
  }
  return null;
}

function StatusDot({ status }: { status: CopilotToolTrace["status"] }) {
  if (status === "running") {
    return <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent shadow-glow" />;
  }
  if (status === "error") {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-wss-high" />;
  }
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/80" />;
}

export default function ToolTraceCard({ trace }: { trace: CopilotToolTrace }) {
  const label = TOOL_LABEL[trace.name] ?? trace.name;
  const inSum = inputSummary(trace.name, trace.input);

  return (
    <div className="rounded-md border border-white/8 bg-white/[0.025] px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <StatusDot status={trace.status} />
        <span className="num text-[11px] font-medium text-text-hi">{label}</span>
        <span className="ml-auto num text-[10px] text-text-lo">
          {trace.status === "running" ? "…" : trace.durationMs != null ? `${trace.durationMs} ms` : ""}
        </span>
      </div>
      {inSum && <div className="num mt-1 pl-3.5 text-[10.5px] leading-snug text-text-lo">{inSum}</div>}
      {trace.status === "ok" && trace.summary && (
        <div className="num mt-0.5 pl-3.5 text-[10.5px] leading-snug text-text-lo/90">{trace.summary}</div>
      )}
      {trace.status === "error" && trace.error && (
        <div className="num mt-0.5 pl-3.5 text-[10.5px] leading-snug text-wss-high/90">{trace.error}</div>
      )}
      {trace.viewNote && (
        <div className="num mt-1 pl-3.5 text-[10px] text-accent/90">→ 3D: {trace.viewNote}</div>
      )}
    </div>
  );
}
