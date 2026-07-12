/** The four tool names Claude can call, exactly as specced. */
export type ToolName =
  | "get_morphology"
  | "query_literature"
  | "find_catheter_path"
  | "highlight_geometry"
  | "perturb_morphology";

export type ToolStatus = "running" | "ok" | "error";

/** One tool invocation, rendered as a collapsible trace card in the chat. */
export interface ToolCallTrace {
  id: string;
  name: ToolName;
  input: Record<string, unknown>;
  status: ToolStatus;
  durationMs?: number;
  resultSummary?: string; // e.g. "3 sources", "7 segments"
  error?: string; // structured error surfaced on graceful degradation
}

export type RiskLevel = "low" | "moderate" | "high" | "indeterminate";
export type Confidence = "low" | "moderate" | "high";

/** Structured risk output, rendered as a card (not prose). */
export interface RiskAssessment {
  level: RiskLevel;
  headline: string;
  reasoningSteps: string[]; // numbered chain
  confidence: Confidence;
  whatWouldChangeMyMind: string[];
  citationIds: string[]; // -> Citation.id in the response's sources
  contested: boolean; // rests on contested WSS↔rupture science
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  traces?: ToolCallTrace[];
  risk?: RiskAssessment;
  sources?: import("./literature").Citation[];
}
