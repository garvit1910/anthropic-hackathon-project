"use client";

import { useState } from "react";
import type { AssistantMessage } from "./useAgentStream";
import ToolTraceCard from "./ToolTraceCard";

/**
 * The live chain of thought: streamed (summarized) reasoning interleaved with
 * the tool calls it triggers. This is the centerpiece — it stays open so the
 * clinician always sees the agent working, not a collapsed summary.
 */
export default function ReasoningStream({ message }: { message: AssistantMessage }) {
  const streaming = message.status === "streaming";
  const [open, setOpen] = useState(true);

  const traceById = new Map(message.traces.map((t) => [t.id, t]));
  const toolCount = message.timeline.filter((i) => i.kind === "tool").length;
  const seconds =
    message.endedAt && message.startedAt ? Math.max(1, Math.round((message.endedAt - message.startedAt) / 1000)) : null;

  const hasContent = message.timeline.length > 0;
  if (!hasContent && !streaming) return null;

  return (
    <div className="panel rounded-md">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="label">Reasoning</span>
        {streaming ? (
          <span className="flex items-center gap-1.5">
            <span className="flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-accent" />
            </span>
            <span className="num text-[10px] text-accent">live</span>
          </span>
        ) : (
          <span className="num text-[10px] text-text-lo">
            {seconds ? `${seconds}s · ` : ""}
            {toolCount} tool{toolCount === 1 ? "" : "s"}
          </span>
        )}
        <span className="ml-auto num text-[11px] text-text-lo">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-hairline px-3 py-2.5">
          {message.timeline.map((item, i) => {
            if (item.kind === "thought") {
              return (
                <p key={i} className="whitespace-pre-wrap text-[12px] leading-relaxed text-text-lo">
                  {item.text}
                  {streaming && i === message.timeline.length - 1 && (
                    <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-accent/70 align-middle" />
                  )}
                </p>
              );
            }
            const t = traceById.get(item.traceId);
            return t ? <ToolTraceCard key={item.traceId} trace={t} /> : null;
          })}
          {streaming && message.timeline.length === 0 && (
            <p className="num text-[11px] text-text-lo">initializing reasoning…</p>
          )}
        </div>
      )}
    </div>
  );
}
