/**
 * embedder.ts — the ONE place that decides how text becomes vectors.
 *
 * BACKEND: Google `gemini-embedding-001` over the REST API (no extra npm dep —
 * uses global fetch). HOSTED, no local fallback for producing vectors. See the
 * three constraints below; all verified in Google's docs.
 *
 * The corpus is embedded ONCE (index-corpus) and committed, so only the query
 * needs the network at demo time. retrieval.ts still degrades to a keyword +
 * metadata scorer if the network is unavailable, so a blip never kills a turn.
 */

const GEMINI_MODEL = "gemini-embedding-001";
// ★ 1536 == 3072 on Google's own MTEB numbers (both 68.17). Half the storage.
const OUTPUT_DIM = Number(process.env.NEUROVAS_EMBED_DIM ?? "1536");
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`;

const MAX_RETRIES = 4;
const THROTTLE_MS = 700; // ~85 rpm, under the 100 rpm free-tier limit

export type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export function geminiKey(): string {
  const key = process.env.GEMINI_API_KEY ?? "";
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY not set. There is no local fallback for PRODUCING vectors.\n" +
        "  Get one: https://aistudio.google.com/apikey\n" +
        "  Then:    echo 'GEMINI_API_KEY=...' >> .env",
    );
  }
  return key;
}

export function embedderName(): string {
  return `gemini:${GEMINI_MODEL}:${OUTPUT_DIM}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** L2-normalize so cosine similarity == dot product (Gemini truncated dims are not unit-length). */
function normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

async function embedOne(text: string, taskType: TaskType): Promise<number[]> {
  const key = geminiKey();
  let last: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}?key=${key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: `models/${GEMINI_MODEL}`,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: OUTPUT_DIM,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        const transient = res.status === 429 || res.status === 503 || res.status >= 500;
        last = new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 200)}`);
        if (!transient || attempt === MAX_RETRIES - 1) throw last;
      } else {
        const json = (await res.json()) as { embedding?: { values?: number[] } };
        const values = json.embedding?.values;
        if (!values || values.length === 0) {
          throw new Error("Gemini returned an empty embedding");
        }
        return normalize(values);
      }
    } catch (e) {
      last = e;
      const msg = String(e).toLowerCase();
      const transient = /429|503|rate|quota|timeout|unavailable|network|fetch failed|econn/.test(msg);
      if (!transient || attempt === MAX_RETRIES - 1) break;
    }
    const wait = 2 ** attempt * 1000; // 1s, 2s, 4s
    process.stderr.write(`[embedder] transient error; retry in ${wait}ms (${attempt + 1}/${MAX_RETRIES})\n`);
    await sleep(wait);
  }

  throw new Error(
    `Gemini embedding failed after ${MAX_RETRIES} attempts: ${String(last)}\n` +
      "  Check: network reachable? GEMINI_API_KEY valid? quota exhausted?",
  );
}

/** ★ Call EXPLICITLY for queries — corpus vs query encoders are an asymmetric pair. */
export function embedQuery(q: string): Promise<number[]> {
  return embedOne(q, "RETRIEVAL_QUERY");
}

/** Embed the corpus (RETRIEVAL_DOCUMENT), throttled. One text per request — no batch endpoint. */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    out.push(await embedOne(texts[i], "RETRIEVAL_DOCUMENT"));
    process.stderr.write(`\r[embedder] embedding corpus: ${i + 1}/${texts.length}`);
    if (i < texts.length - 1) await sleep(THROTTLE_MS);
  }
  process.stderr.write("\n");
  return out;
}
