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

console.log("\n[2] agent artifacts (per UI case)");
// The console drives the agent with the UI case id (ANEUX_042, …). Each needs
// a matching artifacts/case_<id>/ folder, generated from public/cases via
// `npm run gen:artifacts`. C0001 is the legacy standalone case.
const artifactsRoot = path.join(process.cwd(), "artifacts");
const expected = ["case_ANEUX_042", "case_ANEURISK_C0034", "case_CTA_2024_017", "case_LAUSANNE_ds003949_08"];
for (const folder of expected) {
  const caseDir = path.join(artifactsRoot, folder);
  const missing = ["morphology.json", "hemodynamics.json", "graph.json"].filter(
    (f) => !fs.existsSync(path.join(caseDir, f)),
  );
  if (!fs.existsSync(caseDir) || missing.length) {
    bad(`artifacts/${folder} missing ${missing.length ? missing.join(", ") : "(folder)"} — run: npm run gen:artifacts`);
    continue;
  }
  const m = JSON.parse(fs.readFileSync(path.join(caseDir, "morphology.json"), "utf8"));
  const g = m.geometry ?? {};
  ok(`${folder}  ${g.location} Ø${g.max_diameter_mm}mm AR ${g.aspect_ratio}`);
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
