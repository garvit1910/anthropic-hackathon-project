/**
 * stage-viewer-assets.mjs — serve Rounak's viewer + its assets from public/.
 *
 * His viewer.html (embedded in the console iframe) fetches `artifacts/case_${name}/…`
 * relative to itself, so with viewer.html at /viewer.html it resolves to
 * /artifacts/… — which Next only serves from public/. This copies his artifact
 * cases (HIS schema JSON, kept verbatim so his viewer parses them) into
 * public/artifacts/ and DECIMATES the heavy vessel/brain GLBs (weld + meshopt
 * simplify) so they load through the tunnel without stalling/crashing. The
 * aneurysm GLB is left untouched (baked WSS COLOR_0 must not be distorted).
 *
 *   node scripts/stage-viewer-assets.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { dedup, weld, simplify, prune } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "artifacts");
const DST = path.join(ROOT, "public", "artifacts");

// His viewer's CASES list (viewer.html). Only these are reachable from his panel.
const CASES = ["HERO_sub013", "C0001", "CMHA_AHMU1218001", "LAUSANNE_sub000"];
const io = new NodeIO();

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f);
    if (fs.statSync(s).isFile()) fs.copyFileSync(s, path.join(dst, f));
  }
}

async function optimizeGlb(p, ratio) {
  const before = fs.statSync(p).size;
  const doc = await io.read(p);
  await doc.transform(
    dedup(),
    weld({ tolerance: 0.0001 }),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: false }),
    prune(),
  );
  await io.write(p, doc);
  return { before, after: fs.statSync(p).size };
}

async function main() {
  await MeshoptSimplifier.ready;
  console.log("\nstage-viewer-assets → public/artifacts/");
  for (const name of CASES) {
    const src = path.join(SRC, `case_${name}`);
    if (!fs.existsSync(src)) {
      console.log(`  SKIP case_${name} (not in artifacts/)`);
      continue;
    }
    const dst = path.join(DST, `case_${name}`);
    copyDir(src, dst);

    // Decimate heavy meshes in the public copy (leave the aneurysm sac).
    for (const glb of fs.readdirSync(dst).filter((f) => f.endsWith(".glb"))) {
      if (glb === "aneurysm.glb") continue;
      const p = path.join(dst, glb);
      const size = fs.statSync(p).size;
      if (size < 900 * 1024) continue; // small enough already
      // Target ~1MB output; brain hulls simplify hard.
      const ratio = glb === "brain.glb" ? 0.22 : Math.max(0.12, Math.min(0.5, 1_100_000 / size));
      const { before, after } = await optimizeGlb(p, ratio);
      console.log(`  case_${name}/${glb}: ${(before / 1024 / 1024).toFixed(2)}MB → ${(after / 1024 / 1024).toFixed(2)}MB`);
    }
    console.log(`  case_${name}: staged`);
  }
  console.log("");
}

main().catch((e) => {
  console.error("stage-viewer-assets failed:", e);
  process.exit(1);
});
