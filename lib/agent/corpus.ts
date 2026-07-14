/**
 * Corpus loader — the single place that reads the 6 authored JSON files and
 * flattens them into stable, indexable records. Both index-corpus and
 * retrieval.ts load through here, so chunk ids and metadata explosion can
 * never drift apart.
 */

import fs from "node:fs";
import path from "node:path";
import type { CorpusChunk, IndexedChunk } from "./types";

const CORPUS_DIR = path.join(process.cwd(), "lib", "agent", "corpus");
const CORPUS_FILE_RE = /^\d\d_.*\.json$/; // 01_..09_.. ; skips embeddings.json

/**
 * ⚠️ ChromaDB gotcha (documented, preserved here): metadata list values like
 * applies_to: ["ICA","wss"] cannot be filtered directly. Explode into boolean
 * columns applies_ICA: true so a query can filter where={applies_ICA:true}.
 */
function explodeApplies(applies_to: string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const a of applies_to) out[`applies_${a}`] = true;
  return out;
}

export function loadCorpus(): IndexedChunk[] {
  const files = fs
    .readdirSync(CORPUS_DIR)
    .filter((f) => CORPUS_FILE_RE.test(f))
    .sort();

  const chunks: IndexedChunk[] = [];
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, file), "utf8"));
    const corpusFile: string = raw.corpus_file ?? file.replace(/\.json$/, "");
    (raw.chunks as CorpusChunk[]).forEach((c, i) => {
      chunks.push({
        id: `${corpusFile}-${String(i + 1).padStart(2, "0")}`,
        corpusFile,
        text: c.text,
        meta: c.meta,
        applies: explodeApplies(c.meta.applies_to ?? []),
      });
    });
  }
  return chunks;
}

export const EMBEDDINGS_PATH = path.join(CORPUS_DIR, "embeddings.json");

export interface EmbeddingsFile {
  embedder: string; // stamped model name — the silent-killer guard
  dim: number;
  vectors: Record<string, number[]>; // chunk id -> normalized vector
}

export function loadEmbeddings(): EmbeddingsFile | null {
  if (!fs.existsSync(EMBEDDINGS_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(EMBEDDINGS_PATH, "utf8")) as EmbeddingsFile;
  } catch {
    return null;
  }
}
