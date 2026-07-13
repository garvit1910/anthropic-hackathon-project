/**
 * preflight — verify the reasoning core can run before you rely on it on stage.
 * Checks env keys, Rounak's artifacts, the corpus, and the vector index.
 *
 *   npx tsx scripts/preflight.ts
 */

import "./_env";
import fs from "node:fs";
import path from "node:path";
import { loadCorpus } from "../lib/agent/corpus";
import { indexStatus } from "../lib/agent/retrieval";
import { embedderName } from "../lib/agent/embedder";

const G = "\x1b[92m", R = "\x1b[91m", Y = "\x1b[93m", D = "\x1b[2m", X = "\x1b[0m";
const blockers: string[] = [];
const warnings: string[] = [];
const ok = (m: string) => console.log(`  ${G}OK   ${X} ${m}`);
const bad = (m: string) => { console.log(`  ${R}BLOCK${X} ${m}`); blockers.push(m); };
const warn = (m: string) => { console.log(`  ${Y}WARN ${X} ${m}`); warnings.push(m); };

console.log("\n[1] environment keys");
process.env.ANTHROPIC_API_KEY ? ok("ANTHROPIC_API_KEY set") : bad("ANTHROPIC_API_KEY missing — the agent loop cannot run");
ok(`ANTHROPIC_MODEL = ${process.env.ANTHROPIC_MODEL || "claude-opus-4-8 (default)"}`);
process.env.GEMINI_API_KEY
  ? ok("GEMINI_API_KEY set")
  : warn("GEMINI_API_KEY missing — semantic retrieval will fall back to keyword scoring");

console.log("\n[2] artifacts (case_C0001)");
const caseDir = path.join(process.cwd(), "artifacts", "case_C0001");
for (const f of ["morphology.json", "hemodynamics.json", "graph.json"]) {
  const p = path.join(caseDir, f);
  fs.existsSync(p) ? ok(`${f}`) : bad(`artifacts/case_C0001/${f} missing`);
}
if (fs.existsSync(path.join(caseDir, "morphology.json"))) {
  const m = JSON.parse(fs.readFileSync(path.join(caseDir, "morphology.json"), "utf8"));
  if (m.clinical) console.log(`  ${D}     morphology.json carries a clinical block (${Object.keys(m.clinical).join(", ")}) — get_morphology strips it${X}`);
}

console.log("\n[3] corpus");
try {
  const chunks = loadCorpus();
  const contested = chunks.filter((c) => c.meta.contested).length;
  chunks.length === 42 ? ok(`42 chunks (${contested} contested)`) : warn(`${chunks.length} chunks (expected 42), ${contested} contested`);
} catch (e) {
  bad(`corpus failed to load: ${String(e)}`);
}

console.log("\n[4] vector index");
const st = indexStatus();
if (!st.present) {
  warn("embeddings.json absent — run: npx tsx scripts/index-corpus.ts (retrieval works via keyword fallback until then)");
} else if (!st.matches) {
  bad(`embedder mismatch: index built with ${st.stamped}, now ${embedderName()} — re-run index-corpus.ts`);
} else {
  ok(`index present and matches ${embedderName()}`);
}

console.log(`\n${"=".repeat(60)}`);
if (blockers.length) {
  console.log(`${R}${blockers.length} blocker(s):${X}`);
  blockers.forEach((b) => console.log(`  - ${b}`));
} else if (warnings.length) {
  console.log(`${G}No blockers.${X} ${warnings.length} warning(s) — the reasoning core can run.`);
} else {
  console.log(`${G}ALL CLEAR — the reasoning core is ready.${X}`);
}
console.log();
process.exit(blockers.length ? 1 : 0);
