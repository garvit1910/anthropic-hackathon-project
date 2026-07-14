"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentServerEvent, Citation, RiskAssessment, RiskScores } from "@/lib/agent/types";
import { useConsoleStore } from "@/lib/store";
import { HERO_CASE_ID } from "@/lib/cases";
import { directorHandle } from "./agentDirector";
import { postToViewer } from "./viewerBridge";
import { buildHeroRun } from "./heroScript";
import { DEFAULT_FACTORS, type ClinicalFactors } from "@/lib/agent/scoring";

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

/** The copilot is asking the clinician for the scoring factors it can't measure. */
export interface PollState {
  defaults: ClinicalFactors;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  timeline: ReasoningItem[]; // thought → tool → thought …
  traces: CopilotToolTrace[];
  answer: string;
  risk: RiskAssessment | null;
  sources: Citation[];
  scores: RiskScores | null; // computed PHASES/ELAPSS (compute_risk_scores) — tool-authoritative
  morphology: Record<string, unknown> | null; // get_morphology payload, for the chart note
  poll: PollState | null; // when set, render the AssumptionsPoll and await submitFactors
  factors: ClinicalFactors | null; // the clinician's answers, once submitted
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

/** Resolve after `ms`, or immediately when the signal aborts (never rejects). */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      resolve();
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Does this question call for the validated rupture scores (→ ask the clinician for
 * factors)? Excludes the flow / what-if / catheter chips, which don't compute scores.
 * (Hero mode ignores this — its poll is driven by the ruptureRun `awaitFactors` beat;
 * this only gates the live front-load poll.)
 */
function isScoringQuestion(q: string): boolean {
  const s = q.toLowerCase();
  if (/catheter|flow|what if|dome|\bmm\b|bigger|smaller|shear|wss|osi|navigat|access|coil/.test(s)) return false;
  return /rupture|risk|score|phases|elapss|treat|observe|danger|worried|should i/.test(s);
}

export function useAgentStream(caseId: string) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingPoll, setPendingPoll] = useState(false); // a factor poll is awaiting the clinician
  const abortRef = useRef<AbortController | null>(null);
  const draftRef = useRef<AssistantMessage | null>(null);
  const rafRef = useRef<number | null>(null);
  const factorsResolverRef = useRef<((f: ClinicalFactors | null) => void) | null>(null); // resolves a hero mid-run pause
  const pendingLiveRef = useRef<{ question: string } | null>(null); // a live run waiting on the up-front poll
  const lastFactorsRef = useRef<ClinicalFactors>(DEFAULT_FACTORS); // preselect the poll with the last answers

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
          // Stash tool payloads the UI renders directly (numbers stay tool-authoritative).
          if (e.status === "ok" && e.result) {
            if (e.name === "compute_risk_scores") d.scores = e.result as RiskScores;
            else if (e.name === "get_morphology") d.morphology = e.result as Record<string, unknown>;
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

  // Hard-coded, incrementally-revealed reasoning for the hero case: replay a scripted
  // sequence of the same AgentServerEvents through handleEvent (so all rendering + the 3D
  // director work unchanged) plus direct camera-choreography beats.
  const runHeroScript = useCallback(
    async (question: string, signal: AbortSignal) => {
      const beats = buildHeroRun(question, uid);
      for (const b of beats) {
        await sleep(b.delayMs, signal);
        if (signal.aborted) break;

        // A pause beat: show the factor poll, wait for the clinician, then play the
        // factor-dependent continuation (compute + verdict) the beat carries.
        if (b.awaitFactors) {
          const d0 = draftRef.current;
          if (d0) {
            d0.poll = { defaults: lastFactorsRef.current };
            flush(true);
          }
          setPendingPoll(true);
          const factors = await new Promise<ClinicalFactors | null>((resolve) => {
            factorsResolverRef.current = resolve;
            if (signal.aborted) resolve(null);
            else signal.addEventListener("abort", () => resolve(null), { once: true });
          });
          factorsResolverRef.current = null;
          setPendingPoll(false);
          const d1 = draftRef.current;
          if (d1) {
            d1.poll = null;
            if (factors) d1.factors = factors;
            flush(true);
          }
          if (!factors || signal.aborted) break;
          const resumeBeats = b.resume ? b.resume(factors) : [];
          for (const rb of resumeBeats) {
            await sleep(rb.delayMs, signal);
            if (signal.aborted) break;
            if (rb.viewer) postToViewer(rb.viewer);
            if (rb.event) handleEvent(rb.event);
          }
          continue;
        }

        if (b.viewer) postToViewer(b.viewer);
        if (b.event) handleEvent(b.event);
      }
      const d = draftRef.current;
      if (d && d.status === "streaming") {
        if (signal.aborted) {
          d.status = "done";
          d.endedAt = Date.now();
          flush(true);
        } else {
          handleEvent({ type: "done" });
        }
      }
    },
    [handleEvent, flush],
  );

  // The actual run against the draft message already on screen. Factors are only
  // consumed by the live agent (hero collects them mid-run via the poll beat).
  const startRun = useCallback(
    async (question: string, factors: ClinicalFactors) => {
      setIsStreaming(true);
      setReasoningActive(true);
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        // Hero case: replay the hard-coded reasoning (its own camera choreography via beats).
        if (caseId === HERO_CASE_ID) {
          await runHeroScript(question, ac.signal);
          return; // still runs `finally`
        }

        // Live cases keep the real streaming agent; give them a whole-run reasoning-orbit.
        postToViewer({ type: "setThinking", on: true });
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json", "ngrok-skip-browser-warning": "1" },
          body: JSON.stringify({ message: question, caseId, factors }),
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
        postToViewer({ type: "setThinking", on: false }); // guarantee the reasoning-orbit stops (e.g. on abort)
        abortRef.current = null;
      }
    },
    [caseId, handleEvent, runHeroScript, setReasoningActive, flush],
  );

  const submit = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || isStreaming || pendingPoll) return;

      const userMsg: UserMessage = { id: uid("u"), role: "user", text: q };
      const asst: AssistantMessage = {
        id: uid("a"),
        role: "assistant",
        timeline: [],
        traces: [],
        answer: "",
        risk: null,
        sources: [],
        scores: null,
        morphology: null,
        poll: null,
        factors: null,
        status: "streaming",
        startedAt: Date.now(),
      };
      draftRef.current = asst;
      setMessages((prev) => [...prev, userMsg, asst]);

      // Live scoring questions: ask the factors up front (the server run can't pause
      // mid-stream), then start the run in submitFactors. Hero self-pauses mid-run via
      // its ruptureRun beat, so it starts immediately.
      if (isScoringQuestion(q) && caseId !== HERO_CASE_ID) {
        asst.poll = { defaults: lastFactorsRef.current };
        pendingLiveRef.current = { question: q };
        setPendingPoll(true);
        flush(true);
        return;
      }

      await startRun(q, DEFAULT_FACTORS);
    },
    [caseId, isStreaming, pendingPoll, startRun, flush],
  );

  // The clinician answered the poll: resume the hero pause, or start the deferred live run.
  const submitFactors = useCallback(
    (factors: ClinicalFactors) => {
      lastFactorsRef.current = factors;
      if (factorsResolverRef.current) {
        factorsResolverRef.current(factors); // hero: unblock the mid-run pause
        return;
      }
      const pending = pendingLiveRef.current;
      if (pending) {
        pendingLiveRef.current = null;
        setPendingPoll(false);
        const d = draftRef.current;
        if (d) {
          d.poll = null;
          d.factors = factors;
          flush(true);
        }
        void startRun(pending.question, factors);
      }
    },
    [startRun, flush],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, pendingPoll, submit, submitFactors, stop };
}
