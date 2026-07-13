"use client";

import { useEffect, useRef } from "react";
import type { CaseMeta } from "@/types";
import { useConsoleStore } from "@/lib/store";
import { useAgentStream } from "./useAgentStream";
import AssistantTurn from "./AssistantTurn";
import Composer from "./Composer";

/**
 * The reasoning console. Not a chatbot: a scientific transcript where each
 * question streams Claude's live chain of thought + tool traces (which drive
 * the 3D) and lands a structured risk verdict.
 */
export default function CopilotPanel({ caseMeta }: { caseMeta: CaseMeta }) {
  const { messages, isStreaming, submit, stop } = useAgentStream(caseMeta.id);
  const queuedQuestion = useConsoleStore((s) => s.queuedQuestion);
  const queueQuestion = useConsoleStore((s) => s.queueQuestion);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Viewer controls (e.g. What-If "re-assess") queue a question here.
  useEffect(() => {
    if (queuedQuestion && !isStreaming) {
      submit(queuedQuestion);
      queueQuestion(null);
    }
  }, [queuedQuestion, isStreaming, submit, queueQuestion]);

  // Keep the newest reasoning in view as it streams.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const empty = messages.length === 0;

  return (
    <aside className="glass flex h-full min-h-0 flex-col border-t border-hairline lg:border-l lg:border-t-0">
      {/* header */}
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${isStreaming ? "animate-pulse bg-accent" : "bg-accent/60"}`}
          />
          <h2 className="display text-[13px] font-semibold tracking-wide text-text-hi">Reasoning copilot</h2>
        </div>
        <span className="num text-[10px] text-text-lo">
          {isStreaming ? "reasoning…" : "idle"} · {caseMeta.id}
        </span>
      </div>

      {/* transcript */}
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {empty ? (
          <div className="space-y-3">
            <div className="panel rounded-md p-3.5 text-[13px] leading-relaxed text-text-lo">
              A clinical reasoning agent over <span className="text-text-hi">this patient&apos;s</span> geometry
              and the aneurysm literature. Every claim is grounded in a measured value and a source, with confidence
              quantified and contested science flagged. Ask a question — the reasoning streams live and the 3D
              follows it.
            </div>
            <p className="label px-1">Start with</p>
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="border-l-2 border-accent/60 pl-3">
                <div className="label mb-1">Query</div>
                <div className="text-[13.5px] leading-snug text-text-hi">{m.text}</div>
              </div>
            ) : (
              <AssistantTurn key={m.id} message={m} />
            ),
          )
        )}
      </div>

      <Composer onSubmit={submit} onStop={stop} isStreaming={isStreaming} showChips={empty || !isStreaming} />
    </aside>
  );
}
