/** WSS↔rupture stance of a source — used to drive contested-science flags. */
export type LiteratureStance = "high-wss" | "low-wss" | "neutral";

export interface Citation {
  id: string;
  title: string;
  authors: string;
  year: number;
  journal: string;
  doi?: string;
  passage: string; // the retrieved chunk
  relevanceScore: number; // 0..1
  contested: boolean; // sits on the contested WSS↔rupture literature
  stance?: LiteratureStance;
}

/** Output of `query_literature(feature_profile)` — ChromaDB RAG. */
export interface LiteratureResult {
  query: string;
  sources: Citation[];
}
