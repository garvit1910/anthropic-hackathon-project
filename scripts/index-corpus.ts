/**
 * index-corpus — embed the 42 corpus chunks ONCE and write a committed vector
 * index. Only the query needs the network at demo time.
 *
 *   npx tsx scripts/index-corpus.ts
 */

import "./_env";
import fs from "node:fs";
import { loadCorpus, EMBEDDINGS_PATH } from "../lib/agent/corpus";
import { embedDocuments, embedderName, geminiKey } from "../lib/agent/embedder";

async function main() {
  geminiKey(); // hard-fail early if the key is missing

  const chunks = loadCorpus();
  process.stderr.write(`[index] ${chunks.length} chunks; embedding with ${embedderName()}\n`);

  const vectorsArr = await embedDocuments(chunks.map((c) => c.text));

  const vectors: Record<string, number[]> = {};
  chunks.forEach((c, i) => {
    vectors[c.id] = vectorsArr[i];
  });

  const dim = vectorsArr[0]?.length ?? 0;
  const out = { embedder: embedderName(), dim, vectors };
  fs.writeFileSync(EMBEDDINGS_PATH, JSON.stringify(out));

  process.stderr.write(
    `[index] wrote ${chunks.length} vectors (dim ${dim}) -> ${EMBEDDINGS_PATH}\n` +
      `[index] COMMIT this file so demo machines don't re-embed.\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`\n[index] FAILED: ${String(e)}\n`);
  process.exit(1);
});
