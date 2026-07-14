/**
 * agent-cli — drive the reasoning core from the terminal (no frontend).
 * This is how we demonstrate the copilot reasons, not just retrieves.
 *
 *   npx tsx scripts/agent-cli.ts "Will this aneurysm rupture?"
 *   npx tsx scripts/agent-cli.ts --case=C0001 "How would you get a catheter there?"
 */

import "./_env";
import { runAgent } from "../lib/agent/loop";
import type { AgentStreamEvent } from "../lib/agent/types";

const B = "\x1b[1m", G = "\x1b[92m", C = "\x1b[96m", Y = "\x1b[93m", M = "\x1b[95m", D = "\x1b[2m", X = "\x1b[0m";

function parseArgs(argv: string[]): { caseId: string; question: string } {
  let caseId = "C0001";
  const rest: string[] = [];
  for (const a of argv) {
    const m = a.match(/^--case=(.+)$/);
    if (m) caseId = m[1];
    else rest.push(a);
  }
  return { caseId, question: rest.join(" ").trim() || "Will this aneurysm rupture?" };
}

async function main() {
  const { caseId, question } = parseArgs(process.argv.slice(2));

  console.log(`\n${B}NeuroVas Copilot — reasoning core${X}  ${D}(case ${caseId}, model ${process.env.ANTHROPIC_MODEL || "claude-opus-4-8"})${X}`);
  console.log(`${B}Q:${X} ${question}\n`);
  console.log(`${D}--- reasoning + tool trace ---${X}`);

  const started = Date.now();
  let thinkingOpen = false;
  const endThinking = () => {
    if (thinkingOpen) {
      process.stdout.write(`${X}\n`);
      thinkingOpen = false;
    }
  };
  const result = await runAgent(question, {
    caseId,
    onEvent: (e: AgentStreamEvent) => {
      if (e.type === "thinking") {
        if (!thinkingOpen) {
          process.stdout.write(`  ${M}think ${D}`);
          thinkingOpen = true;
        }
        process.stdout.write(e.text);
      } else if (e.type === "tool_call") {
        endThinking();
        const arg = e.name === "query_literature" ? ` ${D}"${(e.input as any).query}"${X}` : "";
        process.stdout.write(`  ${C}→ ${e.name}${X}${arg}\n`);
      } else if (e.type === "tool_result") {
        endThinking();
        if (e.status === "ok") process.stdout.write(`    ${G}✓${X} ${D}${e.summary} (${e.durationMs}ms)${X}\n`);
        else process.stdout.write(`    ${Y}✗ ${e.error}${X}\n`);
      }
      // e.type === "text" deltas are the final answer; printed in full below.
    },
  });
  endThinking();

  console.log(`\n${D}--- answer ---${X}\n`);
  console.log(result.content);

  if (result.risk) {
    const r = result.risk;
    console.log(`\n${D}--- risk assessment (structured) ---${X}`);
    console.log(`  ${B}level${X}       ${r.level}   ${B}confidence${X} ${r.confidence}   ${B}contested${X} ${r.contested}`);
    console.log(`  ${B}headline${X}    ${r.headline}`);
    console.log(`  ${B}reasoning${X}`);
    r.reasoningSteps?.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
    console.log(`  ${B}would change my mind${X}`);
    r.whatWouldChangeMyMind?.forEach((s) => console.log(`    - ${s}`));
    console.log(`  ${B}citations${X}   ${(r.citationIds ?? []).join(", ")}`);
  } else {
    console.log(`\n${Y}(no structured RiskAssessment parsed from the final message)${X}`);
  }

  if (result.sources.length) {
    console.log(`\n${D}--- sources retrieved (${result.sources.length}) ---${X}`);
    for (const s of result.sources) {
      const flag = s.contested ? `${Y}[contested]${X}` : "";
      console.log(`  ${s.id}  ${D}${s.title}${X} ${flag}`);
    }
  }

  console.log(`\n${D}${result.traces.length} tool calls · ${Math.round((Date.now() - started) / 1000)}s${X}\n`);
}

main().catch((e) => {
  console.error(`\n[agent-cli] FAILED: ${String(e)}`);
  process.exit(1);
});
