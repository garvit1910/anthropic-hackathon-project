/**
 * loop.ts — runAgent: the streaming Anthropic tool-use loop.
 *
 * Our code executes the tools and feeds results back; Claude decides what to
 * look up, what to compute, and what it means for this patient. Extended
 * thinking is ON (adaptive, summarized) and streamed live as the copilot's
 * visible chain of thought; tool calls stream as traces that drive the 3D.
 *
 * The loop pushes each turn's full `content` (thinking blocks included) back
 * onto `messages` — that is exactly what preserves thinking across tool_use
 * turns, so no special handling is needed there.
 */

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt";
import { TOOL_DEFS, runTool } from "./tools";
import type { ClinicalFactors } from "./scoring";
import type {
  AgentResult,
  AgentStreamEvent,
  Citation,
  RiskAssessment,
  ToolCallTrace,
} from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const MAX_TOKENS = 16000; // headroom for adaptive thinking + tool turns + answer
const MAX_ITERATIONS = 10;

export interface RunOpts {
  caseId?: string;
  /** Live stream: thinking deltas, answer-prose deltas, and tool traces. */
  onEvent?: (e: AgentStreamEvent) => void;
  /** Abort the run (client disconnected / cancelled). */
  signal?: AbortSignal;
  /** Clinician-supplied scoring factors (from the poll) — injected into compute_risk_scores. */
  factors?: ClinicalFactors;
}

function extractRisk(text: string): { prose: string; risk: RiskAssessment | null } {
  const m = text.match(/```json\s*([\s\S]*?)```/i);
  if (!m) return { prose: text.trim(), risk: null };
  let risk: RiskAssessment | null = null;
  try {
    risk = JSON.parse(m[1].trim()) as RiskAssessment;
  } catch {
    risk = null;
  }
  const prose = text.replace(m[0], "").trim();
  return { prose, risk };
}

export async function runAgent(userText: string, opts: RunOpts = {}): Promise<AgentResult> {
  const caseId = opts.caseId ?? "C0001";
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const emit = (e: AgentStreamEvent) => opts.onEvent?.(e);

  const messages: any[] = [
    {
      role: "user",
      content: `The active case is ${caseId}. Reason about this specific patient.\n\nQuestion: ${userText}`,
    },
  ];

  const traces: ToolCallTrace[] = [];
  const sourceMap = new Map<string, Citation>();
  const turnTexts: string[] = [];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    if (opts.signal?.aborted) break;

    const stream = client.messages.stream(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFS as any,
        messages,
        // Adaptive extended thinking, summarized so the reasoning is human-readable
        // and streamable as the visible chain of thought.
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: "high" },
      } as any,
      { signal: opts.signal },
    );

    // Token-level deltas → live reasoning + answer stream.
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta") {
        const d = chunk.delta as any;
        if (d.type === "thinking_delta" && d.thinking) {
          emit({ type: "thinking", text: d.thinking });
        } else if (d.type === "text_delta" && d.text) {
          emit({ type: "text", text: d.text });
        }
      }
    }

    const response = await stream.finalMessage();
    // Push the FULL content (thinking blocks + text + tool_use) back — required
    // to preserve thinking across tool_use turns.
    messages.push({ role: "assistant", content: response.content });

    const turnText = (response.content as any[])
      .filter((b) => b.type === "text" && b.text?.trim())
      .map((b) => b.text)
      .join("\n\n");
    if (turnText) turnTexts.push(turnText);

    if (response.stop_reason !== "tool_use") break;

    // Execute every tool_use block; return all results in one user message.
    const toolUses = (response.content as any[]).filter((b) => b.type === "tool_use");
    const toolResults: any[] = [];

    for (const tu of toolUses) {
      const trace: ToolCallTrace = { id: tu.id, name: tu.name, input: tu.input, status: "running" };
      traces.push(trace);
      emit({ type: "tool_call", id: tu.id, name: tu.name, input: tu.input });

      const started = Date.now();
      try {
        const { result, summary } = await runTool(tu.name, { caseId, ...tu.input, factors: opts.factors });
        trace.status = "ok";
        trace.durationMs = Date.now() - started;
        trace.resultSummary = summary;

        if (tu.name === "query_literature" && result && (result as any).sources) {
          for (const s of (result as any).sources as Citation[]) sourceMap.set(s.id, s);
        }

        emit({
          type: "tool_result",
          id: tu.id,
          name: tu.name,
          status: "ok",
          durationMs: trace.durationMs,
          summary,
          result, // full payload — the viewer director acts on this
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        });
      } catch (e) {
        trace.status = "error";
        trace.durationMs = Date.now() - started;
        trace.error = String(e);
        emit({
          type: "tool_result",
          id: tu.id,
          name: tu.name,
          status: "error",
          durationMs: trace.durationMs,
          error: String(e),
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Tool error: ${String(e)}`,
          is_error: true, // graceful degradation — the model can adapt
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  // The substantive answer + RiskAssessment JSON may not be the LAST turn — the
  // model can emit a trailing highlight_geometry call (and a short closing turn)
  // after it. Extract from the last turn that actually carries a ```json block.
  let source = turnTexts[turnTexts.length - 1] ?? "";
  for (let i = turnTexts.length - 1; i >= 0; i--) {
    if (/```json/i.test(turnTexts[i])) {
      source = turnTexts[i];
      break;
    }
  }
  const { prose, risk } = extractRisk(source);

  return {
    role: "assistant",
    content: prose,
    traces,
    risk,
    sources: Array.from(sourceMap.values()),
  };
}
