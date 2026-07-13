/**
 * retrieval.ts — query_literature.
 *
 * RAG here is not "how Claude finds an answer" — it is how Claude's judgment
 * about THIS patient becomes defensible. Every chunk carries epistemic metadata
 * (contested / direction / evidence) so the retrieval itself tells the model
 * when the science is disputed.
 *
 * Primary path: embed the query with the SAME model that built the index
 * (gemini RETRIEVAL_QUERY) and rank by cosine. Fallback: keyword + metadata
 * scoring, so a network blip degrades loudly-but-usefully instead of erroring.
 */

import {
  loadCorpus,
  loadEmbeddings,
  type EmbeddingsFile,
} from "./corpus";
import { embedQuery, embedderName } from "./embedder";
import type {
  Citation,
  IndexedChunk,
  LiteratureResult,
  LiteratureStance,
} from "./types";

const CHUNKS: IndexedChunk[] = loadCorpus();
const EMB: EmbeddingsFile | null = loadEmbeddings();

/**
 * ★★ The silent killer: an index built with model A and queried with model B
 * returns nonsense without raising. We stamp the model name into the index and
 * check it here.
 */
export function indexStatus(): { present: boolean; matches: boolean; stamped?: string } {
  if (!EMB) return { present: false, matches: false };
  return { present: true, matches: EMB.embedder === embedderName(), stamped: EMB.embedder };
}

function stanceOf(c: IndexedChunk): LiteratureStance {
  const s = c.meta.subtopic ?? "";
  if (s.includes("low_wss")) return "low-wss";
  if (s.includes("high_wss")) return "high-wss";
  return "neutral";
}

function toCitation(c: IndexedChunk, score: number): Citation {
  return {
    id: c.id,
    title: c.meta.source,
    citation: c.meta.citation,
    year: c.meta.year ?? null,
    passage: c.text,
    topic: c.meta.topic,
    direction: c.meta.direction,
    evidence: c.meta.evidence,
    contested: c.meta.contested,
    relevanceScore: Math.round(Math.max(0, Math.min(1, score)) * 1000) / 1000,
    stance: stanceOf(c),
  };
}

function cosine(a: number[], b: number[]): number {
  // both are L2-normalized on write → dot product is cosine
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) d += a[i] * b[i];
  return d;
}

const STOP = new Set(
  "the a an and or of to in on for with is are was were be been by at as from that this it its into than then over under between both each not no non any all its their his her".split(
    " ",
  ),
);
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

// Precompute document token sets for the keyword fallback.
const DOC_TOKENS = CHUNKS.map((c) => new Set(tokens(c.text + " " + c.meta.source + " " + c.meta.subtopic)));

function keywordScore(qTokens: string[], docIdx: number): number {
  const doc = DOC_TOKENS[docIdx];
  if (qTokens.length === 0) return 0;
  let hit = 0;
  for (const t of qTokens) if (doc.has(t)) hit++;
  return hit / qTokens.length;
}

export interface QueryOpts {
  topic?: string;
  applies_to?: string | string[];
  contestedOnly?: boolean;
  k?: number;
}

function passesFilters(c: IndexedChunk, opts: QueryOpts): boolean {
  if (opts.topic && c.meta.topic !== opts.topic) return false;
  if (opts.contestedOnly && !c.meta.contested) return false;
  if (opts.applies_to) {
    const wanted = Array.isArray(opts.applies_to) ? opts.applies_to : [opts.applies_to];
    for (const a of wanted) if (!c.applies[`applies_${a}`]) return false;
  }
  return true;
}

export async function queryLiterature(
  query: string,
  opts: QueryOpts = {},
): Promise<LiteratureResult> {
  const k = opts.k ?? 5;

  // Filter first; if the filter empties the result set (a classic $contains
  // trap), relax it rather than return nothing.
  let pool = CHUNKS.map((c, i) => ({ c, i })).filter((x) => passesFilters(x.c, opts));
  let relaxed = false;
  if (pool.length === 0) {
    pool = CHUNKS.map((c, i) => ({ c, i }));
    relaxed = true;
  }

  let mode: "semantic" | "keyword" = "keyword";
  let scored: { c: IndexedChunk; score: number }[];

  const status = indexStatus();
  const canSemantic = status.present && status.matches && !!process.env.GEMINI_API_KEY;

  if (canSemantic && EMB) {
    try {
      const qVec = await embedQuery(query);
      scored = pool
        .map(({ c }) => {
          const v = EMB.vectors[c.id];
          return { c, score: v ? cosine(qVec, v) : -1 };
        })
        .filter((s) => s.score > -1);
      mode = "semantic";
    } catch (e) {
      process.stderr.write(`[retrieval] semantic path failed, falling back to keyword: ${String(e)}\n`);
      const qt = tokens(query);
      scored = pool.map(({ c, i }) => ({ c, score: keywordScore(qt, i) }));
    }
  } else {
    if (status.present && !status.matches) {
      process.stderr.write(
        `[retrieval] EMBEDDER MISMATCH (index=${status.stamped}, now=${embedderName()}); ` +
          "using keyword fallback. Re-run: npx tsx scripts/index-corpus.ts\n",
      );
    }
    const qt = tokens(query);
    scored = pool.map(({ c, i }) => ({ c, score: keywordScore(qt, i) }));
  }

  scored.sort((a, b) => b.score - a.score);
  const sources = scored.slice(0, k).map((s) => toCitation(s.c, s.score));

  return {
    query,
    mode,
    filters: { ...opts, relaxed },
    sources,
  };
}
