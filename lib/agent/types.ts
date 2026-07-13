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
