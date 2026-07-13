/**
 * gen-artifacts.mjs — bridge the two data universes.
 *
 * The 3D viewer reads `public/cases/{id}/…` (camelCase, pre-centered coords,
 * string graph ids, tortuosity as an arc/chord-EXCESS ratio ~0.08). The Claude
 * reasoning core (`lib/agent/tools.ts`) reads `artifacts/case_{id}/…` in a
 * DIFFERENT schema (snake_case, numeric graph ids + `entry_nodes`/`aneurysm_node`,
 * tortuosity as an arc/chord RATIO ~1.08, `mean_radius_mm`, `polyline`).
 *
 * This script transforms the viewer assets into agent artifacts so the copilot
 * reasons over the SAME case the viewer shows, with coherent numbers. Both sides
 * derive from one fixture set, so Ø / AR / location never contradict each other.
 *
 *   node scripts/gen-artifacts.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC_CASES = path.join(ROOT, "public", "cases");
const ARTIFACTS = path.join(ROOT, "artifacts");

// Rupture outcome per case. get_morphology STRIPS the clinical block before the
// model sees it (outcome-leak guard) — this is only here so the on-disk artifact
// is well-formed and preflight's "clinical block present" note fires.
const RUPTURE_STATUS = {
  ANEUX_042: "unruptured",
  ANEURISK_C0034: "unknown",
  CTA_2024_017: "ruptured",
  LAUSANNE_ds003949_08: "unruptured",
};

// Authoritative vessel location per case (mirrors CaseMeta in lib/cases.ts, which
// is what the console header shows). The viewer fixtures all say "ICA"; override
// so the agent reasons about the same vessel the clinician sees, and so
// location-filtered literature retrieval (ICA / MCA / AComm / PComm) is correct.
const CASE_LOCATION = {
  ANEUX_042: "ICA",
  ANEURISK_C0034: "MCA",
  CTA_2024_017: "AComm",
  LAUSANNE_ds003949_08: "PComm",
};

const r3 = (n) => (typeof n === "number" ? Math.round(n * 1000) / 1000 : n);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** Viewer tortuosity is arc/chord-1 (~0.08); the agent expects arc/chord (~1.08). */
function toRatioTortuosity(t) {
  if (typeof t !== "number") return 1;
  return t < 1 ? r3(1 + t) : r3(t);
}

/** manifest.wss (Pa + %) → the agent's flat hemodynamics.json (analytic proxy). */
function buildHemodynamics(wss) {
  const lowFrac = typeof wss?.lowShearAreaPct === "number" ? wss.lowShearAreaPct / 100 : null;
  return {
    peak_wss_pa: r3(wss?.maxPa),
    mean_wss_pa: r3(wss?.meanPa),
    // OSI is not measured by the viewer pipeline; derive a labeled analytic proxy
    // from the low-shear fraction so the field is present and internally coherent.
    osi_max: lowFrac != null ? r3(Math.min(0.4, 0.1 + 0.5 * lowFrac)) : 0.3,
    low_shear_area_fraction: lowFrac != null ? r3(lowFrac) : null,
    _tier: "3-analytic-proxy",
    _note:
      "Poiseuille WSS from vessel radii; OSI & low-shear are analytic sac estimates, NOT a transient CFD solve. Suggestive, not decisive (WSS<->rupture is contested).",
  };
}

/** Viewer morphology.json (camelCase) → agent morphology.json (snake_case). */
function buildMorphology(id, morph, hemo) {
  return {
    case_id: id,
    geometry: {
      max_diameter_mm: r3(morph.maxDiameterMm),
      height_mm: r3(morph.domeHeightMm),
      neck_width_mm: r3(morph.neckWidthMm),
      aspect_ratio: r3(morph.aspectRatio),
      size_ratio: r3(morph.sizeRatio),
      location: CASE_LOCATION[id] ?? morph.location,
    },
    hemodynamics: hemo, // nested fallback; hemodynamics.json is authoritative
    clinical: {
      rupture_status: RUPTURE_STATUS[id] ?? "unknown",
      _note: "Withheld from the model — get_morphology strips this block.",
    },
  };
}

/** Viewer graph.json (string ids, centerline) → agent graph.json (numeric, polyline). */
function buildGraph(id, graph) {
  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];
  const idx = new Map(nodes.map((n, i) => [n.id, i]));

  const outNodes = nodes.map((n, i) => ({
    id: i,
    pos: n.position,
    type: n.type,
    radius: r3(n.radiusMm),
    name: n.name,
  }));

  const outEdges = edges.map((e, i) => ({
    id: i,
    source: idx.get(e.source),
    target: idx.get(e.target),
    length_mm: r3(e.lengthMm),
    mean_radius_mm: r3(e.avgRadiusMm),
    tortuosity: toRatioTortuosity(e.tortuosity),
    polyline: e.centerline ?? [],
  }));

  const entryNodes = nodes
    .map((n, i) => (n.type === "inlet" ? i : -1))
    .filter((i) => i >= 0);
  const aneurysmIdx = nodes.findIndex((n) => n.type === "aneurysm");

  return {
    case_id: id,
    units: "mm",
    nodes: outNodes,
    edges: outEdges,
    entry_nodes: entryNodes,
    aneurysm_node: aneurysmIdx,
  };
}

function main() {
  if (!fs.existsSync(PUBLIC_CASES)) {
    console.error(`No public/cases directory at ${PUBLIC_CASES}`);
    process.exit(1);
  }
  const ids = fs
    .readdirSync(PUBLIC_CASES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  console.log(`\ngen-artifacts — ${ids.length} case(s) from public/cases\n`);
  let wrote = 0;

  for (const id of ids) {
    const dir = path.join(PUBLIC_CASES, id);
    const morphP = path.join(dir, "morphology.json");
    const manifP = path.join(dir, "manifest.json");
    const graphP = path.join(dir, "graph.json");

    if (!fs.existsSync(morphP) || !fs.existsSync(graphP)) {
      console.log(`  SKIP  ${id} — missing morphology.json/graph.json`);
      continue;
    }

    const morph = readJson(morphP);
    const manifest = fs.existsSync(manifP) ? readJson(manifP) : {};
    const graph = readJson(graphP);

    const hemo = buildHemodynamics(manifest.wss ?? {});
    const outMorph = buildMorphology(id, morph, hemo);
    const outGraph = buildGraph(id, graph);

    const outDir = path.join(ARTIFACTS, `case_${id}`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "morphology.json"), JSON.stringify(outMorph, null, 2));
    fs.writeFileSync(path.join(outDir, "hemodynamics.json"), JSON.stringify(hemo, null, 2));
    fs.writeFileSync(path.join(outDir, "graph.json"), JSON.stringify(outGraph, null, 2));

    const flags = [];
    if (outGraph.aneurysm_node < 0) flags.push("NO aneurysm node");
    if (!outGraph.entry_nodes.length) flags.push("NO entry node");
    const warn = flags.length ? `  ⚠ ${flags.join(", ")}` : "";
    console.log(
      `  OK    case_${id}  Ø${outMorph.geometry.max_diameter_mm}mm AR ${outMorph.geometry.aspect_ratio} ` +
        `${outMorph.geometry.location} · WSS peak ${hemo.peak_wss_pa}Pa · ` +
        `graph ${outGraph.nodes.length}n/${outGraph.edges.length}e${warn}`,
    );
    wrote++;
  }

  console.log(`\nWrote artifacts for ${wrote} case(s) into artifacts/case_*/\n`);
}

main();
