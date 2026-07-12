/**
 * Generates mock case assets so the entire frontend is demoable before the
 * real (Python) pipeline lands. Produces, per case:
 *   vessel_tree.glb  — a Y-bifurcation tube network (mesh "vessel_tree")
 *   aneurysm.glb     — a dome sphere (mesh "aneurysm_dome") with COLOR_0 WSS
 *   graph.json, streamlines.json, morphology.json, manifest.json
 *
 * These satisfy the fixed contract in types/. Run: npm run gen:fixtures
 */
import { Document, NodeIO } from "@gltf-transform/core";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "cases");

// --- tiny vector helpers ---
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// --- WSS ramp (mirrors lib/palette WSS_RAMP) ---
const RAMP = [
  { t: 0.0, c: [0.169, 0.424, 1.0] }, // #2b6cff
  { t: 0.35, c: [0.498, 0.357, 1.0] }, // #7f5bff
  { t: 0.6, c: [1.0, 0.361, 0.796] }, // #ff5ccb
  { t: 1.0, c: [1.0, 0.2, 0.0] }, // #ff3300
];
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < RAMP.length - 1; i++) {
    const a = RAMP[i];
    const b = RAMP[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = (t - a.t) / (b.t - a.t || 1);
      return [
        a.c[0] + (b.c[0] - a.c[0]) * k,
        a.c[1] + (b.c[1] - a.c[1]) * k,
        a.c[2] + (b.c[2] - a.c[2]) * k,
      ];
    }
  }
  return RAMP[RAMP.length - 1].c;
}

// --- geometry builders ---
function buildSphere(r, wSeg, hSeg, center, colorFn) {
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  for (let y = 0; y <= hSeg; y++) {
    const theta = (y / hSeg) * Math.PI;
    for (let x = 0; x <= wSeg; x++) {
      const phi = (x / wSeg) * Math.PI * 2;
      const nx = Math.sin(theta) * Math.cos(phi);
      const ny = Math.cos(theta);
      const nz = Math.sin(theta) * Math.sin(phi);
      pos.push(center[0] + nx * r, center[1] + ny * r, center[2] + nz * r);
      nor.push(nx, ny, nz);
      if (colorFn) {
        const c = colorFn(nx, ny, nz);
        col.push(c[0], c[1], c[2], 1);
      }
    }
  }
  const row = wSeg + 1;
  for (let y = 0; y < hSeg; y++) {
    for (let x = 0; x < wSeg; x++) {
      const a = y * row + x;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  return { pos, nor, col, idx };
}

function buildTube(path, r, radial, out) {
  const base = out.pos.length / 3;
  const rings = [];
  const up = [0, 1, 0];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const pNext = path[Math.min(i + 1, path.length - 1)];
    const pPrev = path[Math.max(i - 1, 0)];
    const t = norm(sub(pNext, pPrev));
    let n = cross(t, up);
    if (len(n) < 1e-4) n = cross(t, [1, 0, 0]);
    n = norm(n);
    const b = norm(cross(t, n));
    rings.push(out.pos.length / 3);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const dir = add(scale(n, Math.cos(a)), scale(b, Math.sin(a)));
      out.pos.push(p[0] + dir[0] * r, p[1] + dir[1] * r, p[2] + dir[2] * r);
      out.nor.push(dir[0], dir[1], dir[2]);
    }
  }
  for (let i = 0; i < path.length - 1; i++) {
    const s0 = rings[i];
    const s1 = rings[i + 1];
    for (let j = 0; j < radial; j++) {
      out.idx.push(s0 + j, s1 + j, s0 + j + 1, s0 + j + 1, s1 + j, s1 + j + 1);
    }
  }
  return base;
}

function samplePath(a, b, n, bow = [0, 0, 0]) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const straight = add(scale(a, 1 - k), scale(b, k));
    const bend = Math.sin(k * Math.PI);
    pts.push(add(straight, scale(bow, bend)));
  }
  return pts;
}

async function writeGlb(path, meshName, attrs) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const prim = doc
    .createPrimitive()
    .setAttribute(
      "POSITION",
      doc
        .createAccessor()
        .setType("VEC3")
        .setArray(new Float32Array(attrs.pos))
        .setBuffer(buffer)
    )
    .setAttribute(
      "NORMAL",
      doc
        .createAccessor()
        .setType("VEC3")
        .setArray(new Float32Array(attrs.nor))
        .setBuffer(buffer)
    )
    .setIndices(
      doc
        .createAccessor()
        .setType("SCALAR")
        .setArray(new Uint32Array(attrs.idx))
        .setBuffer(buffer)
    );
  if (attrs.col && attrs.col.length) {
    prim.setAttribute(
      "COLOR_0",
      doc
        .createAccessor()
        .setType("VEC4")
        .setArray(new Float32Array(attrs.col))
        .setBuffer(buffer)
    );
  }
  const mesh = doc.createMesh(meshName).addPrimitive(prim);
  const node = doc.createNode(meshName).setMesh(mesh);
  doc.createScene().addChild(node);
  await new NodeIO().write(path, doc);
}

// --- case configs (mirror lib/cases.ts) ---
const CASES = [
  { id: "ANEUX_042", domeMm: 7.2, neckMm: 3.4, parentMm: 4.0, ar: 2.1, sizeRatio: 1.8 },
  { id: "ANEURISK_C0034", domeMm: 5.4, neckMm: 3.6, parentMm: 3.2, ar: 1.5, sizeRatio: 1.7 },
  { id: "CTA_2024_017", domeMm: 9.8, neckMm: 3.5, parentMm: 3.8, ar: 2.8, sizeRatio: 2.6 },
  { id: "LAUSANNE_ds003949_08", domeMm: 4.1, neckMm: 3.4, parentMm: 3.5, ar: 1.2, sizeRatio: 1.2 },
];

// bifurcation skeleton (shared shape; aneurysm scales per case)
const INLET = [0, -12, 0];
const BIF = [0, -2, 0];
const TERM_L = [-8, 6, 2];
const TERM_R = [7, 7, -2];

async function buildCase(cfg) {
  const dir = join(OUT, cfg.id);
  mkdirSync(dir, { recursive: true });

  // vessel tree
  const vessel = { pos: [], nor: [], col: [], idx: [] };
  const trunk = samplePath(INLET, BIF, 16, [0.6, 0, 0.4]);
  const left = samplePath(BIF, TERM_L, 16, [-1.5, 0, 1.2]);
  const right = samplePath(BIF, TERM_R, 16, [1.6, 0, -1.0]);
  buildTube(trunk, cfg.parentMm * 0.4, 14, vessel);
  buildTube(left, cfg.parentMm * 0.3, 12, vessel);
  buildTube(right, cfg.parentMm * 0.3, 12, vessel);
  await writeGlb(join(dir, "vessel_tree.glb"), "vessel_tree", vessel);

  // aneurysm dome at the bifurcation apex, WSS by outward exposure + swirl
  const domeR = cfg.domeMm * 0.45;
  const domeCenter = [1.4, -0.4, 1.4];
  const aneurysm = buildSphere(domeR, 48, 32, domeCenter, (nx, ny, nz) => {
    // High shear where flow impinges (outer/upper), low near the neck (down).
    const impinge = Math.max(0, ny * 0.55 + nx * 0.25 + 0.4);
    const swirl = 0.2 * Math.sin(nx * 6 + nz * 5);
    return ramp(impinge + swirl);
  });
  await writeGlb(join(dir, "aneurysm.glb"), "aneurysm_dome", aneurysm);

  // graph.json
  const graph = {
    nodes: [
      { id: "ICA_R", name: "ICA inlet", position: INLET, type: "inlet", radiusMm: cfg.parentMm / 2 },
      { id: "BIF_1", name: "bifurcation apex", position: BIF, type: "bifurcation", radiusMm: cfg.parentMm / 2 },
      { id: "TERM_L", name: "distal branch L", position: TERM_L, type: "terminal", radiusMm: cfg.parentMm / 3 },
      { id: "TERM_R", name: "distal branch R", position: TERM_R, type: "terminal", radiusMm: cfg.parentMm / 3 },
      { id: "ANEURYSM", name: "aneurysm dome", position: domeCenter, type: "aneurysm", radiusMm: domeR },
    ],
    edges: [
      { id: "E_TRUNK", source: "ICA_R", target: "BIF_1", lengthMm: 10.4, avgRadiusMm: cfg.parentMm / 2, tortuosity: 0.08, maxAngleDeg: 18, centerline: trunk },
      { id: "E_LEFT", source: "BIF_1", target: "TERM_L", lengthMm: 12.1, avgRadiusMm: cfg.parentMm / 3, tortuosity: 0.22, maxAngleDeg: 47, centerline: left },
      { id: "E_RIGHT", source: "BIF_1", target: "TERM_R", lengthMm: 11.5, avgRadiusMm: cfg.parentMm / 3, tortuosity: 0.19, maxAngleDeg: 39, centerline: right },
      { id: "E_NECK", source: "BIF_1", target: "ANEURYSM", lengthMm: cfg.neckMm, avgRadiusMm: cfg.neckMm / 2, tortuosity: 0.03, maxAngleDeg: 12, centerline: [BIF, domeCenter] },
    ],
  };
  writeFileSync(join(dir, "graph.json"), JSON.stringify(graph, null, 2));

  // streamlines.json — flow up the trunk, some curling into the dome
  const streamlines = [];
  for (let s = 0; s < 6; s++) {
    const off = (s - 2.5) * 0.5;
    const trunkSeg = samplePath(add(INLET, [off, 0, off * 0.5]), BIF, 20, [0.6, 0, 0.4]);
    const target = s < 2 ? domeCenter : s < 4 ? TERM_L : TERM_R;
    const outSeg = samplePath(BIF, target, 20, [off, 0, -off]);
    streamlines.push({
      id: `SL_${s}`,
      points: trunkSeg.concat(outSeg),
      seedRegion: "inlet",
    });
  }
  writeFileSync(join(dir, "streamlines.json"), JSON.stringify(streamlines, null, 2));

  // morphology.json
  const morphology = {
    caseId: cfg.id,
    location: "ICA",
    domeHeightMm: +(cfg.neckMm * cfg.ar).toFixed(2),
    neckWidthMm: cfg.neckMm,
    maxDiameterMm: cfg.domeMm,
    aspectRatio: cfg.ar,
    sizeRatio: cfg.sizeRatio,
    nonSphericityIndex: +(0.12 + cfg.ar * 0.03).toFixed(3),
    undulationIndex: +(0.03 + cfg.ar * 0.02).toFixed(3),
    inflowAngleDeg: 112,
    parentVesselDiameterMm: cfg.parentMm,
    elementIds: {
      dome: "aneurysm_dome",
      neck: "neck_region",
      inflow_jet: "SL_0",
      parent_vessel: "E_TRUNK",
    },
  };
  writeFileSync(join(dir, "morphology.json"), JSON.stringify(morphology, null, 2));

  // manifest.json — element registry + WSS stats
  const manifest = {
    caseId: cfg.id,
    elements: [
      { id: "aneurysm_dome", kind: "mesh", ref: "aneurysm_dome", label: "Aneurysm dome", anchor: domeCenter },
      { id: "neck_region", kind: "region", ref: "E_NECK", label: "Neck", anchor: [0.7, -1.2, 0.7] },
      { id: "aneurysm_node", kind: "node", ref: "ANEURYSM", label: "Aneurysm", anchor: domeCenter },
      { id: "bifurcation", kind: "node", ref: "BIF_1", label: "Bifurcation apex", anchor: BIF },
      { id: "inlet", kind: "node", ref: "ICA_R", label: "ICA inlet", anchor: INLET },
    ],
    wss: {
      minPa: 0.4,
      maxPa: 14.6,
      meanPa: 3.9,
      lowShearAreaPct: 22 + Math.round(cfg.ar * 4),
      highShearAreaPct: 11,
    },
  };
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`  ✓ ${cfg.id}`);
}

async function main() {
  console.log("Generating mock case fixtures →", OUT);
  for (const cfg of CASES) await buildCase(cfg);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
