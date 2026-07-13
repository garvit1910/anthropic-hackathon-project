/**
 * loop.ts — runAgent: the Anthropic tool-use loop.
 *
 * Our code executes the tools and feeds results back; Claude decides what to
 * look up, what to compute, and what it means for this patient. The loop
 * accumulates tool-call traces and literature citations, and parses the final
 * structured RiskAssessment out of the model's closing message.
 */

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt";
import { TOOL_DEFS, runTool } from "./tools";
import type { AgentResult, Citation, RiskAssessment, ToolCallTrace } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const MAX_TOKENS = 8000;
const MAX_ITERATIONS = 10;

export interface RunOpts {
  caseId?: string;
  onTrace?: (t: ToolCallTrace) => void;
  onText?: (text: string) => void;
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

  const messages: any[] = [
    {
      role: "user",
      content: `The active case is ${caseId}. Reason about this specific patient.\n\nQuestion: ${userText}`,
    },
  ];

  const traces: ToolCallTrace[] = [];
  const sourceMap = new Map<string, Citation>();
  // The answer is the model's FINAL turn (prose + JSON, per the system prompt).
  // We keep the last non-empty prose as a fallback in case the final turn is
  // structured-only, but we don't fold mid-loop narration into the answer.
  let finalTurnText = "";
  let lastProse = "";

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFS as any,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    const turnText = (response.content as any[])
      .filter((b) => b.type === "text" && b.text?.trim())
      .map((b) => b.text)
      .join("\n\n");
    if (turnText) {
      lastProse = turnText;
      opts.onText?.(turnText);
    }

    if (response.stop_reason !== "tool_use") {
      finalTurnText = turnText;
      break;
    }

    // Execute every tool_use block, return all results in one user message.
    const toolUses = (response.content as any[]).filter((b) => b.type === "tool_use");
    const toolResults: any[] = [];

    for (const tu of toolUses) {
      const trace: ToolCallTrace = {
        id: tu.id,
        name: tu.name,
        input: tu.input,
        status: "running",
      };
      traces.push(trace);
      opts.onTrace?.(trace);

      const started = Date.now();
      try {
        const { result, summary } = await runTool(tu.name, { caseId, ...tu.input });
        trace.status = "ok";
        trace.durationMs = Date.now() - started;
        trace.resultSummary = summary;

        // Accumulate literature citations for the final answer.
        if (tu.name === "query_literature" && result && (result as any).sources) {
          for (const s of (result as any).sources as Citation[]) sourceMap.set(s.id, s);
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        });
      } catch (e) {
        trace.status = "error";
        trace.durationMs = Date.now() - started;
        trace.error = String(e);
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Tool error: ${String(e)}`,
          is_error: true, // graceful degradation — the model can adapt
        });
      }
      opts.onTrace?.(trace);
    }

    messages.push({ role: "user", content: toolResults });
  }

  const { prose, risk } = extractRisk(finalTurnText.trim() ? finalTurnText : lastProse);

  return {
    role: "assistant",
    content: prose,
    traces,
    risk,
    sources: Array.from(sourceMap.values()),
  };
}
