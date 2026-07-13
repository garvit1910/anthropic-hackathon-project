/**
 * adopt-hero.mjs — bring Rounak's real HERO model into the viewer.
 *
 * His `artifacts/case_HERO_sub013/` is authored in the AGENT schema (snake_case,
 * integer graph ids, wrapped streamlines, absolute-mm frame, no manifest). Our
 * react-three-fiber viewer reads `public/cases/{id}/` in a different schema
 * (camelCase, string ids, bare-array streamlines, a manifest.json registry).
 *
 * This copies his GLBs verbatim (our bbox-normalization handles the coordinate
 * frame at render time) and transforms his JSON into the viewer schema, plus
 * synthesizes a manifest.json from the graph + wss + morphology.
 *
 *   node scripts/adopt-hero.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CASE = "HERO_sub013";
const SRC = path.join(ROOT, "artifacts", `case_${CASE}`);
const DST = path.join(ROOT, "public", "cases", CASE);

const r3 = (n) => (typeof n === "number" ? Math.round(n * 1000) / 1000 : n);
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// His node types → our viewer types.
const TYPE_MAP = { entry: "inlet", endpoint: "terminal", bifurcation: "bifurcation", aneurysm: "aneurysm" };
const nid = (i) => `n${i}`;

function buildGraph(src) {
  const nodes = (src.nodes ?? []).map((n) => ({
    id: nid(n.id),
    name: n.type === "aneurysm" ? "Aneurysm" : n.type === "entry" ? "Vessel inlet" : n.type,
    position: n.pos,
    type: TYPE_MAP[n.type] ?? "bifurcation",
    radiusMm: r3(n.radius),
  }));
  const edges = (src.edges ?? []).map((e) => ({
    id: `e${e.id}`,
    source: nid(e.source),
    target: nid(e.target),
    lengthMm: r3(e.length_mm),
    avgRadiusMm: r3(e.mean_radius_mm),
    tortuosity: r3(e.tortuosity),
    maxAngleDeg: 0, // his edges don't carry turn angle; bifurcation flags come from the node_path
    centerline: e.polyline ?? [],
  }));
  return { nodes, edges };
}

function buildStreamlines(src) {
  const lines = src.streamlines ?? [];
  return lines.map((l, i) => ({
    id: `SL_${i}`,
    points: l.points ?? [],
    seedRegion: i === 0 ? "inlet" : "vessel",
    speeds: l.speed ?? undefined,
  }));
}

function buildMorphology(m) {
  const g = m.geometry ?? {};
  const parentVesselDiameterMm = g.size_ratio > 0 ? r3(g.max_diameter_mm / g.size_ratio) : null;
  return {
    caseId: CASE,
    location: g.location ?? "other",
    domeHeightMm: r3(g.height_mm),
    neckWidthMm: r3(g.neck_width_mm),
    maxDiameterMm: r3(g.max_diameter_mm),
    aspectRatio: r3(g.aspect_ratio),
    sizeRatio: r3(g.size_ratio),
    nonSphericityIndex: 0,
    undulationIndex: 0,
    inflowAngleDeg: 0,
    parentVesselDiameterMm,
    elementIds: {
      dome: "aneurysm_dome",
      neck: "neck_region",
      inflow_jet: "SL_0",
      parent_vessel: "parent_vessel",
    },
  };
}

function buildManifest(graphSrc, wss, morph) {
  const byId = new Map((graphSrc.nodes ?? []).map((n) => [n.id, n]));
  const aneurysmNode = byId.get(graphSrc.aneurysm_node);
  const entries = (graphSrc.entry_nodes ?? []).map((i) => byId.get(i)).filter(Boolean);

  // Parent-vessel junction = the OTHER endpoint of the edge touching the aneurysm node.
  let parentNode = null;
  for (const e of graphSrc.edges ?? []) {
    if (e.source === graphSrc.aneurysm_node) parentNode = byId.get(e.target);
    else if (e.target === graphSrc.aneurysm_node) parentNode = byId.get(e.source);
    if (parentNode) break;
  }

  const domeAnchor = aneurysmNode ? aneurysmNode.pos : [0, 0, 0];
  const elements = [
    { id: "aneurysm_dome", kind: "mesh", ref: "aneurysm_dome", label: "Aneurysm dome", anchor: domeAnchor },
    { id: "aneurysm_node", kind: "node", ref: nid(graphSrc.aneurysm_node), label: "Aneurysm", anchor: domeAnchor },
    { id: "neck_region", kind: "region", ref: "neck", label: "Neck", anchor: domeAnchor },
  ];
  entries.forEach((n, i) =>
    elements.push({
      id: i === 0 ? "inlet" : `inlet_${i}`,
      kind: "node",
      ref: nid(n.id),
      label: entries.length > 1 ? `Vessel inlet ${i === 0 ? "L" : "R"}` : "Vessel inlet",
      anchor: n.pos,
    }),
  );
  if (parentNode)
    elements.push({ id: "bifurcation", kind: "node", ref: nid(parentNode.id), label: "Parent vessel", anchor: parentNode.pos });

  // high-shear fraction from per-vertex WSS (for the legend), threshold at 60% of range.
  let highPct = 0;
  const pv = wss.per_vertex_wss_pa ?? [];
  if (pv.length) {
    const hi = wss.min_wss_pa + 0.6 * (wss.peak_wss_pa - wss.min_wss_pa);
    highPct = Math.round((100 * pv.filter((v) => v >= hi).length) / pv.length);
  }
  const hemo = morph.hemodynamics ?? {};

  return {
    caseId: CASE,
    elements,
    wss: {
      minPa: r3(wss.min_wss_pa),
      maxPa: r3(wss.peak_wss_pa),
      meanPa: r3(hemo.mean_wss_pa ?? (wss.min_wss_pa + wss.peak_wss_pa) / 2),
      lowShearAreaPct: r3((hemo.low_shear_area_fraction ?? 0) * 100),
      highShearAreaPct: highPct,
    },
  };
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing ${SRC} — run: git checkout origin/ronuk -- artifacts/case_${CASE}/`);
    process.exit(1);
  }
  fs.mkdirSync(DST, { recursive: true });

  // GLBs verbatim (incl. brain hull).
  for (const glb of ["vessel_tree.glb", "aneurysm.glb", "brain.glb"]) {
    fs.copyFileSync(path.join(SRC, glb), path.join(DST, glb));
  }
  // catheter routes pass through (already in the shared frame).
  fs.copyFileSync(path.join(SRC, "catheter_paths.json"), path.join(DST, "catheter_paths.json"));

  const graphSrc = readJson(path.join(SRC, "graph.json"));
  const morph = readJson(path.join(SRC, "morphology.json"));
  const wss = readJson(path.join(SRC, "wss.json"));
  const streamSrc = readJson(path.join(SRC, "streamlines.json"));

  fs.writeFileSync(path.join(DST, "graph.json"), JSON.stringify(buildGraph(graphSrc)));
  fs.writeFileSync(path.join(DST, "streamlines.json"), JSON.stringify(buildStreamlines(streamSrc)));
  fs.writeFileSync(path.join(DST, "morphology.json"), JSON.stringify(buildMorphology(morph), null, 2));
  fs.writeFileSync(path.join(DST, "manifest.json"), JSON.stringify(buildManifest(graphSrc, wss, morph), null, 2));

  const g = morph.geometry ?? {};
  console.log(`\nadopt-hero → public/cases/${CASE}/`);
  console.log(`  GLBs: vessel_tree + aneurysm + brain`);
  console.log(`  graph: ${graphSrc.nodes.length} nodes / ${graphSrc.edges.length} edges (aneurysm ${graphSrc.aneurysm_node}, entries ${JSON.stringify(graphSrc.entry_nodes)})`);
  console.log(`  streamlines: ${streamSrc.streamlines.length} lines`);
  console.log(`  morphology: Ø${g.max_diameter_mm}mm AR ${g.aspect_ratio} SR ${g.size_ratio} · ${g.location}`);
  console.log(`  manifest wss: ${r3(wss.min_wss_pa)}–${r3(wss.peak_wss_pa)} Pa\n`);
}

main();
