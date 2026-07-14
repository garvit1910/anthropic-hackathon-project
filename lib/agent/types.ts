/**
 * Internal types for the NeuroVas reasoning core.
 *
 * These mirror the frontend contract in `types/agent.ts` and `types/literature.ts`
 * (RiskAssessment, ToolCallTrace, Citation, ChatMessage) so a later delivery can
 * wire the API route straight into the console. The reasoning core does not depend
 * on the frontend barrel — it re-declares the shapes it emits.
 */

export type RiskLevel = "low" | "moderate" | "high" | "indeterminate";
export type Confidence = "low" | "moderate" | "high";
export type LiteratureStance = "high-wss" | "low-wss" | "neutral";
export type ToolStatus = "running" | "ok" | "error";

/** One retrieved evidence chunk, carrying its epistemic metadata. */
export interface Citation {
  id: string;
  title: string;
  citation: string;
  year: number | null;
  passage: string;
  topic: string;
  direction: string;
  evidence: string;
  contested: boolean;
  relevanceScore: number; // 0..1
  stance: LiteratureStance;
}

export interface LiteratureResult {
  query: string;
  filters?: Record<string, unknown>;
  mode: "semantic" | "keyword";
  sources: Citation[];
}

/** Structured risk output — rendered as a card, not prose. */
export interface RiskAssessment {
  level: RiskLevel;
  headline: string;
  reasoningSteps: string[];
  confidence: Confidence;
  whatWouldChangeMyMind: string[];
  citationIds: string[];
  contested: boolean;
}

/** One line of a PHASES/ELAPSS point ledger. */
export interface ScoreComponent {
  key: string;
  name: string;
  value: string;
  points: number;
  assumed?: boolean; // input was defaulted (we don't have it) — flag it in the UI
}

/** Computed validated clinical scores (compute_risk_scores). Numbers are tool-authoritative. */
export interface RiskScores {
  caseId: string;
  inputsUsed: { maxDiameterMm: number; location: string; ageBand: string };
  phases: {
    total: number;
    fiveYearRuptureRiskPct: number;
    riskLabel: string;
    components: ScoreComponent[];
    assumptions: { field: string; assumedValue: string; ifPresent: string }[];
    citationId: string;
    instrument: string;
  };
  elapss: {
    total: number;
    maxPoints: number;
    growthRiskBand: "low" | "moderate" | "high";
    components: ScoreComponent[];
    note: string;
    citationId: string;
    instrument: string;
  };
  datasetReference: { phase: number | null; elapss: number | null; note: string } | null;
  citationIds: string[];
  _note: string;
}

/** One tool invocation, surfaced as a collapsible trace card. */
export interface ToolCallTrace {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  durationMs?: number;
  resultSummary?: string;
  error?: string;
}

/** What runAgent returns — a ChatMessage-shaped assistant turn. */
export interface AgentResult {
  role: "assistant";
  content: string;
  traces: ToolCallTrace[];
  risk: RiskAssessment | null;
  sources: Citation[];
}

/**
 * Streaming events emitted by runAgent while it works (thinking + tool traces).
 * The HTTP route serializes these as SSE; the CLI prints them.
 */
export type AgentStreamEvent =
  | { type: "thinking"; text: string } // summarized-reasoning delta
  | { type: "text"; text: string } // final-answer prose delta
  | { type: "tool_call"; id: string; name: string; input: Record<string, unknown> }
  | {
      type: "tool_result";
      id: string;
      name: string;
      status: ToolStatus;
      durationMs?: number;
      summary?: string;
      error?: string;
      result?: unknown; // full payload — the viewer director acts on this
    };

/**
 * The full server→client SSE contract: the streaming events above plus the
 * terminal structured results. `answer` carries the clean prose (JSON stripped).
 */
export type AgentServerEvent =
  | AgentStreamEvent
  | { type: "answer"; content: string }
  | { type: "risk"; risk: RiskAssessment | null }
  | { type: "sources"; sources: Citation[] }
  | { type: "done" }
  | { type: "error"; message: string };

/** The raw corpus chunk shape as authored on disk. */
export interface CorpusMeta {
  source: string;
  citation: string;
  year?: number;
  topic: string;
  subtopic?: string;
  direction: string;
  contested: boolean;
  evidence: string;
  n?: number;
  applies_to: string[];
}

export interface CorpusChunk {
  text: string;
  meta: CorpusMeta;
}

/** A flattened, indexable corpus record with a stable id + exploded metadata. */
export interface IndexedChunk {
  id: string; // e.g. "hemodynamics_wss-05"
  corpusFile: string;
  text: string;
  meta: CorpusMeta;
  applies: Record<string, boolean>; // exploded applies_to -> { applies_ICA: true, ... }
}
