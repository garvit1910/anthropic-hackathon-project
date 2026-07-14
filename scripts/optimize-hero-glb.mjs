/**
 * optimize-hero-glb.mjs — shrink the heavy HERO meshes so they load fast and
 * light through a tunnel (ngrok) and on memory-constrained browsers.
 *
 * The vessel tree (3.4MB / 86k verts) and brain hull (1.6MB / 40k verts) are
 * marching-cubes output with lots of redundant geometry. Weld + decimate cuts
 * both file size and GPU memory several-fold. Positions stay float (no
 * quantization) so the viewer's runtime computeVertexNormals() still works.
 * The aneurysm is left untouched (tiny, and its baked WSS COLOR_0 must not be
 * distorted).
 *
 *   node scripts/optimize-hero-glb.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { dedup, weld, simplify, prune } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

const DIR = path.join(process.cwd(), "public", "cases", "HERO_sub013");
const io = new NodeIO();

async function optimize(file, ratio) {
  const p = path.join(DIR, file);
  const before = fs.statSync(p).size;
  const doc = await io.read(p);
  await doc.transform(
    dedup(),
    weld({ tolerance: 0.0001 }),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: false }),
    prune(),
  );
  await io.write(p, doc);
  const after = fs.statSync(p).size;
  let v = 0;
  doc.getRoot().listMeshes().forEach((m) => m.listPrimitives().forEach((pr) => (v += pr.getAttribute("POSITION").getCount())));
  console.log(`  ${file}: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB (${v} verts)`);
}

async function main() {
  await MeshoptSimplifier.ready;
  console.log("\noptimize-hero-glb:");
  await optimize("vessel_tree.glb", 0.35); // ~60k → ~21k tris
  await optimize("brain.glb", 0.22); // context hull — decimate hard
  console.log("  aneurysm.glb: left untouched (baked WSS heatmap)\n");
}

main().catch((e) => {
  console.error("optimize failed:", e);
  process.exit(1);
});
