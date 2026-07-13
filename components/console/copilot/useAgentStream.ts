"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentServerEvent, Citation, RiskAssessment } from "@/lib/agent/types";
import { useConsoleStore } from "@/lib/store";
import { directorHandle } from "./agentDirector";

export interface CopilotToolTrace {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: "running" | "ok" | "error";
  durationMs?: number;
  summary?: string;
  error?: string;
  viewNote?: string; // "→ 3D" note describing the view change it triggered
}

/** One item in the interleaved reasoning trace: a thought, or a tool call. */
export type ReasoningItem = { kind: "thought"; text: string } | { kind: "tool"; traceId: string };

export interface AssistantMessage {
  id: string;
  role: "assistant";
  timeline: ReasoningItem[]; // thought → tool → thought …
  traces: CopilotToolTrace[];
  answer: string;
  risk: RiskAssessment | null;
  sources: Citation[];
  status: "streaming" | "done" | "error";
  error?: string;
  startedAt: number;
  endedAt?: number;
}

export interface UserMessage {
  id: string;
  role: "user";
  text: string;
}

export type CopilotMessage = UserMessage | AssistantMessage;

let counter = 0;
const uid = (p: string) => `${p}-${++counter}-${Date.now()}`;

export function useAgentStream(caseId: string) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const draftRef = useRef<AssistantMessage | null>(null);
  const rafRef = useRef<number | null>(null);

  const setReasoningActive = useConsoleStore((s) => s.setReasoningActive);

  // Coalesce rapid token deltas into one state update per animation frame.
  const flush = useCallback((immediate = false) => {
    const commit = () => {
      rafRef.current = null;
      const d = draftRef.current;
      if (!d) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === d.id ? { ...d, timeline: [...d.timeline], traces: [...d.traces], sources: [...d.sources] } : m,
        ),
      );
    };
    if (immediate) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      commit();
      return;
    }
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(commit);
  }, []);

  const handleEvent = useCallback(
    (e: AgentServerEvent) => {
      const d = draftRef.current;
      if (!d) return;

      const viewNote = directorHandle(e); // drive the 3D

      switch (e.type) {
        case "thinking": {
          const last = d.timeline[d.timeline.length - 1];
          if (last && last.kind === "thought") last.text += e.text;
          else d.timeline.push({ kind: "thought", text: e.text });
          flush();
          break;
        }
        case "text":
          d.answer += e.text;
          flush();
          break;
        case "tool_call":
          d.traces.push({ id: e.id, name: e.name, input: e.input, status: "running", viewNote });
          d.timeline.push({ kind: "tool", traceId: e.id });
          flush(true);
          break;
        case "tool_result": {
          const t = d.traces.find((x) => x.id === e.id);
          if (t) {
            t.status = e.status;
            t.durationMs = e.durationMs;
            t.summary = e.summary;
            t.error = e.error;
            if (viewNote) t.viewNote = viewNote;
          }
          flush(true);
          break;
        }
        case "answer":
          d.answer = e.content; // authoritative clean prose
          flush(true);
          break;
        case "risk":
          d.risk = e.risk;
          flush(true);
          break;
        case "sources":
          d.sources = e.sources;
          flush(true);
          break;
        case "done":
          d.status = "done";
          d.endedAt = Date.now();
          flush(true);
          break;
        case "error":
          d.status = "error";
          d.error = e.message;
          d.endedAt = Date.now();
          flush(true);
          break;
      }
    },
    [flush],
  );

  const submit = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || isStreaming) return;

      const userMsg: UserMessage = { id: uid("u"), role: "user", text: q };
      const asst: AssistantMessage = {
        id: uid("a"),
        role: "assistant",
        timeline: [],
        traces: [],
        answer: "",
        risk: null,
        sources: [],
        status: "streaming",
        startedAt: Date.now(),
      };
      draftRef.current = asst;
      setMessages((prev) => [...prev, userMsg, asst]);
      setIsStreaming(true);
      setReasoningActive(true);

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json", "ngrok-skip-browser-warning": "1" },
          body: JSON.stringify({ message: q, caseId }),
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          let msg = `Request failed (${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch {
            /* non-JSON */
          }
          handleEvent({ type: "error", message: msg });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const line = chunk.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            try {
              handleEvent(JSON.parse(json) as AgentServerEvent);
            } catch {
              /* skip malformed frame */
            }
          }
        }
        if (draftRef.current && draftRef.current.status === "streaming") {
          handleEvent({ type: "done" });
        }
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          handleEvent({ type: "error", message: String((err as Error)?.message ?? err) });
        } else if (draftRef.current && draftRef.current.status === "streaming") {
          draftRef.current.status = "done";
          draftRef.current.endedAt = Date.now();
          flush(true);
        }
      } finally {
        setIsStreaming(false);
        setReasoningActive(false);
        abortRef.current = null;
      }
    },
    [caseId, isStreaming, handleEvent, setReasoningActive, flush],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, submit, stop };
}
