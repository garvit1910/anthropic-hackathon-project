/**
 * tools.ts — the reasoning core's tool functions + the Anthropic tool registry.
 *
 * The geometry/graph tools read Rounak's REAL artifacts (artifacts/case_C0001).
 * get_morphology strips the outcome leak and surfaces CFD provenance; the
 * others compute things the model cannot do in its head (A* routing, what-if
 * re-derivation). query_literature is wired to the RAG in retrieval.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { queryLiterature, type QueryOpts } from "./retrieval";

const ARTIFACTS = path.join(process.cwd(), "artifacts");
const CATHETER_MIN_RADIUS_MM = 0.35; // guiding-catheter fit — a HARD constraint

function caseDir(caseId: string): string {
  const folder = caseId.startsWith("case_") ? caseId : `case_${caseId}`;
  return path.join(ARTIFACTS, folder);
}
function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// ---------------------------------------------------------------------------
// get_morphology — THIS patient's real numbers, leak stripped, provenance shown
// ---------------------------------------------------------------------------

export function getMorphology(caseId: string) {
  const dir = caseDir(caseId);
  const morph = readJson(path.join(dir, "morphology.json"));
  const g = morph.geometry ?? {};

  // ★ hemodynamics.json is authoritative; fall back to the (now-consistent)
  //   nested block only if the separate file is absent.
  let hemo = morph.hemodynamics ?? {};
  const hemoPath = path.join(dir, "hemodynamics.json");
  if (fs.existsSync(hemoPath)) hemo = readJson(hemoPath);

  // ★★ NEVER expose morph.clinical (rupture_status/age/sex) — outcome leak.

  const maxD = g.max_diameter_mm;
  const neck = g.neck_width_mm;
  const sr = g.size_ratio;
  const lsaf = hemo.low_shear_area_fraction;

  return {
    caseId: morph.case_id ?? caseId,
    location: g.location,
    geometry: {
      maxDiameterMm: maxD,
      domeHeightMm: g.height_mm,
      neckWidthMm: neck,
      aspectRatio: g.aspect_ratio,
      sizeRatio: sr,
    },
    hemodynamics: {
      peakWssPa: hemo.peak_wss_pa,
      meanWssPa: hemo.mean_wss_pa,
      osiMax: hemo.osi_max,
      lowShearAreaFraction: lsaf,
      // ★★ Provenance the agent MUST surface — a proxy is not a solve.
      provenanceTier: hemo._tier ?? hemo.tier ?? "unknown",
      provenanceNote:
        hemo._note ??
        hemo.note ??
        "No provenance stamped; treat magnitudes as illustrative, not a CFD solve.",
    },
    // Purely factual arithmetic helpers (NOT clinical judgments — those are the
    // model's job): the reciprocal neck ratios and the size-band membership.
    derivedFacts: {
      domeToNeckRatio:
        typeof maxD === "number" && typeof neck === "number" && neck > 0
          ? Math.round((maxD / neck) * 1000) / 1000
          : null,
      neckWidthMeetsWideNeckCriterion: typeof neck === "number" ? neck >= 4 : null, // SEAL/Contour: neck >= 4mm
      lowShearAreaPct: typeof lsaf === "number" ? Math.round(lsaf * 1000) / 10 : null,
      ucasSizeBand:
        typeof maxD === "number"
          ? maxD < 5
            ? "3-4mm (0.36%/yr) or 5-6mm boundary"
            : maxD < 7
              ? "5-6mm (0.50%/yr)"
              : maxD < 10
                ? "7-9mm (1.69%/yr)"
                : maxD < 25
                  ? "10-24mm (4.37%/yr)"
                  : ">=25mm (33.4%/yr)"
          : null,
    },
    _note:
      "The rupture outcome label and patient identifiers are intentionally withheld from you.",
  };
}

// ---------------------------------------------------------------------------
// perturb_morphology — recompute AR/SR; INVALIDATE hemodynamics (geometry-bound)
// ---------------------------------------------------------------------------

export function perturbMorphology(
  caseId: string,
  patch: { domeSizeMm?: number; neckWidthMm?: number },
) {
  const dir = caseDir(caseId);
  const g = readJson(path.join(dir, "morphology.json")).geometry ?? {};
  const origMaxD = g.max_diameter_mm;
  const origHeight = g.height_mm;
  const origNeck = g.neck_width_mm;
  const origSR = g.size_ratio;
  const parentVesselMm = origSR > 0 ? origMaxD / origSR : null;

  const newMaxD = patch.domeSizeMm ?? origMaxD;
  // Scale dome height with the dome's overall size change (keeps the sac shape).
  const scale = origMaxD > 0 ? newMaxD / origMaxD : 1;
  const newHeight = origHeight * scale;
  const newNeck = patch.neckWidthMm ?? origNeck;

  const newAR = newNeck > 0 ? Math.round((newHeight / newNeck) * 1000) / 1000 : null;
  const newSR =
    parentVesselMm && parentVesselMm > 0
      ? Math.round((newMaxD / parentVesselMm) * 1000) / 1000
      : null;

  return {
    caseId,
    applied: patch,
    before: {
      maxDiameterMm: origMaxD,
      domeHeightMm: origHeight,
      neckWidthMm: origNeck,
      aspectRatio: g.aspect_ratio,
      sizeRatio: origSR,
    },
    after: {
      maxDiameterMm: Math.round(newMaxD * 1000) / 1000,
      domeHeightMm: Math.round(newHeight * 1000) / 1000,
      neckWidthMm: newNeck,
      aspectRatio: newAR,
      sizeRatio: newSR,
    },
    hemodynamicsValid: false,
    hemodynamicsNote:
      "The prior CFD field (WSS/OSI/low-shear) is solved for the ORIGINAL geometry and is NO LONGER VALID for this perturbed shape — intra-aneurysmal flow is highly sensitive to neck size and dome size. Morphology (aspect ratio, size ratio) CAN be recomputed from the new geometry; hemodynamics CANNOT and would require re-running the simulation. See hemodynamics_wss-08 (geometry-dependence).",
  };
}

// ---------------------------------------------------------------------------
// find_catheter_path — Dijkstra over the centerline graph (entry -> aneurysm)
// ---------------------------------------------------------------------------

interface GEdge {
  id: number;
  source: number;
  target: number;
  length_mm: number;
  mean_radius_mm: number;
  tortuosity: number;
}

function segDifficulty(tortuosity: number): "low" | "moderate" | "high" {
  if (tortuosity < 1.2) return "low";
  if (tortuosity < 1.6) return "moderate";
  return "high";
}

export function findCatheterPath(caseId: string) {
  const g = readJson(path.join(caseDir(caseId), "graph.json"));
  const edges: GEdge[] = g.edges ?? [];
  const aneurysmNode: number = g.aneurysm_node;
  const entryNodes: number[] = g.entry_nodes ?? [];

  // Undirected adjacency. Radius < catheter minimum => impassable (drop edge).
  const adj = new Map<number, { to: number; edge: GEdge }[]>();
  let impassableCount = 0;
  let minRadiusOverall = Infinity;
  for (const e of edges) {
    minRadiusOverall = Math.min(minRadiusOverall, e.mean_radius_mm);
    if (e.mean_radius_mm < CATHETER_MIN_RADIUS_MM) {
      impassableCount++;
      continue; // hard constraint: not high-cost, IMPASSABLE
    }
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push({ to: e.target, edge: e });
    adj.get(e.target)!.push({ to: e.source, edge: e });
  }

  // Dijkstra from a virtual super-source over all entry nodes.
  const dist = new Map<number, number>();
  const prev = new Map<number, { node: number; edge: GEdge }>();
  const visited = new Set<number>();
  for (const s of entryNodes) dist.set(s, 0);

  while (visited.size < adj.size + 1) {
    let u = -1;
    let best = Infinity;
    dist.forEach((d, node) => {
      if (!visited.has(node) && d < best) {
        best = d;
        u = node;
      }
    });
    if (u === -1) break;
    visited.add(u);
    if (u === aneurysmNode) break;
    for (const { to, edge } of adj.get(u) ?? []) {
      // Cost = length weighted by tortuosity (tortuosity is the operative
      // difficulty driver here; there is no per-segment turn-angle field, and
      // no edge is sub-catheter so the caliber constraint does not bind).
      const cost = edge.length_mm * edge.tortuosity;
      const nd = (dist.get(u) ?? Infinity) + cost;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, { node: u, edge });
      }
    }
  }

  const feasible = dist.has(aneurysmNode) && dist.get(aneurysmNode)! < Infinity;
  if (!feasible) {
    return {
      caseId,
      feasible: false,
      reason: "No radius-passable centerline path from an entry node to the aneurysm node.",
      entryNodes,
      aneurysmNode,
      impassableEdges: impassableCount,
    };
  }

  // Reconstruct.
  const segments: any[] = [];
  let totalLength = 0;
  let weighted = 0;
  let maxTort = 0;
  let minRadius = Infinity;
  let cur = aneurysmNode;
  while (prev.has(cur)) {
    const { node, edge } = prev.get(cur)!;
    segments.push({
      edgeId: edge.id,
      fromNode: node,
      toNode: cur,
      lengthMm: Math.round(edge.length_mm * 1000) / 1000,
      meanRadiusMm: Math.round(edge.mean_radius_mm * 1000) / 1000,
      tortuosity: Math.round(edge.tortuosity * 1000) / 1000,
      difficulty: segDifficulty(edge.tortuosity),
    });
    totalLength += edge.length_mm;
    weighted += edge.length_mm * edge.tortuosity;
    maxTort = Math.max(maxTort, edge.tortuosity);
    minRadius = Math.min(minRadius, edge.mean_radius_mm);
    cur = node;
  }
  segments.reverse();

  const meanTort = totalLength > 0 ? weighted / totalLength : 1;
  const difficultyScore = Math.round(Math.max(0, Math.min(1, (meanTort - 1) / 1.0)) * 1000) / 1000;

  return {
    caseId,
    feasible: true,
    entryNode: segments.length ? segments[0].fromNode : entryNodes[0],
    targetNode: aneurysmNode,
    totalLengthMm: Math.round(totalLength * 1000) / 1000,
    maxTortuosity: Math.round(maxTort * 1000) / 1000,
    minRadiusMm: Math.round(minRadius * 1000) / 1000,
    difficultyScore, // 0..1, driven by length-weighted tortuosity
    segments,
    caliberConstraint: {
      catheterMinRadiusMm: CATHETER_MIN_RADIUS_MM,
      minVesselRadiusMm: Math.round(minRadiusOverall * 1000) / 1000,
      impassableEdges: impassableCount,
      binds: impassableCount > 0,
      note:
        impassableCount > 0
          ? `${impassableCount} edge(s) are below the ${CATHETER_MIN_RADIUS_MM}mm catheter minimum and were excluded as impassable.`
          : `No vessel on this anatomy is below the ${CATHETER_MIN_RADIUS_MM}mm catheter minimum, so the caliber constraint does not bind here — difficulty is driven by tortuosity, not vessel size. Say so honestly rather than implying the constraint was decisive.`,
    },
  };
}

// ---------------------------------------------------------------------------
// highlight_geometry — structured spatial-reasoning command (payload only)
// ---------------------------------------------------------------------------

const ELEMENT_VOCAB = ["aneurysm_dome", "neck", "aneurysm_node", "entry_node", "parent_vessel"];

export function highlightGeometry(input: {
  elementIds: string[];
  mode?: string;
  annotation?: string;
}) {
  const known = (input.elementIds ?? []).filter((e) => ELEMENT_VOCAB.includes(e));
  const unknown = (input.elementIds ?? []).filter((e) => !ELEMENT_VOCAB.includes(e));
  return {
    command: "highlight_geometry",
    elementIds: known,
    mode: input.mode ?? null,
    annotation: input.annotation ?? null,
    unknownElementIds: unknown,
    vocabulary: ELEMENT_VOCAB,
    _note: "Structured highlight command emitted for the viewer bus (not rendered in this build).",
  };
}

// ---------------------------------------------------------------------------
// Anthropic tool registry + dispatch
// ---------------------------------------------------------------------------

export const TOOL_DEFS = [
  {
    name: "get_morphology",
    description:
      "Return THIS patient's real aneurysm measurements and hemodynamics for a case. " +
      "CALL THIS FIRST, before any literature query — every downstream literature search must be derived from these numbers. " +
      "Returns geometry (max diameter, dome height, neck width, aspect ratio, size ratio, location), " +
      "hemodynamics (WSS, OSI, low-shear area fraction) WITH a provenance tier/note you MUST surface, " +
      "and purely factual derived arithmetic. The rupture outcome label is intentionally withheld.",
    input_schema: {
      type: "object",
      properties: {
        caseId: { type: "string", description: "Case id, e.g. 'C0001'." },
      },
      required: ["caseId"],
    },
  },
  {
    name: "query_literature",
    description:
      "Semantic search over a 42-chunk evidence index of the aneurysm literature. " +
      "Call AFTER get_morphology, and fire several NARROW queries derived from the patient's numbers " +
      "(e.g. size band, low-shear area fraction, location, wide-neck coiling) rather than one vague query. " +
      "Each source carries epistemic metadata: contested (the science is disputed), direction, evidence type, and a WSS stance. " +
      "When sources disagree (they will on WSS), weigh them — do not report both and shrug.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The natural-language evidence question." },
        topic: {
          type: "string",
          description: "Optional filter: one of size, aspect_ratio, wss, access, location.",
        },
        applies_to: {
          type: "string",
          description: "Optional filter by applicability tag, e.g. ICA, wss, low_shear_area_fraction, wide_neck.",
        },
        contestedOnly: { type: "boolean", description: "Optional: only return contested chunks." },
        k: { type: "number", description: "Number of sources to return (default 5)." },
      },
      required: ["query"],
    },
  },
  {
    name: "find_catheter_path",
    description:
      "Run a shortest-path (Dijkstra) search over the patient's centerline graph from a vessel entry node to the aneurysm, " +
      "with vessel caliber below the catheter minimum treated as a HARD impassability constraint. " +
      "Returns per-segment length, tortuosity and difficulty, a total length, and an overall difficulty score. " +
      "Use for endovascular access / navigation questions. Report honestly whether the caliber constraint actually binds.",
    input_schema: {
      type: "object",
      properties: { caseId: { type: "string", description: "Case id, e.g. 'C0001'." } },
      required: ["caseId"],
    },
  },
  {
    name: "perturb_morphology",
    description:
      "Recompute aspect ratio and size ratio for a hypothetical 'what if the dome/neck were X mm' scenario. " +
      "CRITICAL: this recomputes MORPHOLOGY only. It explicitly INVALIDATES the hemodynamics (WSS/OSI/low-shear), " +
      "because a CFD field is solved for one specific geometry and cannot be extrapolated to a perturbed shape. " +
      "Surface that staleness in your answer.",
    input_schema: {
      type: "object",
      properties: {
        caseId: { type: "string", description: "Case id, e.g. 'C0001'." },
        domeSizeMm: { type: "number", description: "New dome (max diameter) size in mm." },
        neckWidthMm: { type: "number", description: "New neck width in mm." },
      },
      required: ["caseId"],
    },
  },
  {
    name: "highlight_geometry",
    description:
      "Emit a structured command to highlight anatomy for the viewer (spatial reasoning). " +
      "elementIds must come from the vocabulary: aneurysm_dome, neck, aneurysm_node, entry_node, parent_vessel.",
    input_schema: {
      type: "object",
      properties: {
        elementIds: { type: "array", items: { type: "string" }, description: "Elements to highlight." },
        mode: { type: "string", description: "Optional viewer mode (anatomy | hemodynamics | whatif | navigation)." },
        annotation: { type: "string", description: "Optional short label." },
      },
      required: ["elementIds"],
    },
  },
];

export async function runTool(
  name: string,
  input: Record<string, any>,
): Promise<{ result: unknown; summary: string }> {
  switch (name) {
    case "get_morphology": {
      const r = getMorphology(input.caseId ?? "C0001");
      return {
        result: r,
        summary: `${r.location} ${r.geometry.maxDiameterMm}mm, AR ${r.geometry.aspectRatio}, LSAF ${r.derivedFacts.lowShearAreaPct}%`,
      };
    }
    case "query_literature": {
      const opts: QueryOpts = {
        topic: input.topic,
        applies_to: input.applies_to,
        contestedOnly: input.contestedOnly,
        k: input.k,
      };
      const r = await queryLiterature(input.query, opts);
      const contested = r.sources.filter((s) => s.contested).length;
      return {
        result: r,
        summary: `${r.sources.length} sources (${contested} contested) via ${r.mode}`,
      };
    }
    case "find_catheter_path": {
      const r = findCatheterPath(input.caseId ?? "C0001");
      return {
        result: r,
        summary: r.feasible
          ? `${(r as any).segments.length} segments, ${(r as any).totalLengthMm}mm, difficulty ${(r as any).difficultyScore}`
          : "no feasible path",
      };
    }
    case "perturb_morphology": {
      const r = perturbMorphology(input.caseId ?? "C0001", {
        domeSizeMm: input.domeSizeMm,
        neckWidthMm: input.neckWidthMm,
      });
      return {
        result: r,
        summary: `AR ${r.before.aspectRatio}->${r.after.aspectRatio}, SR ${r.before.sizeRatio}->${r.after.sizeRatio}, hemo invalidated`,
      };
    }
    case "highlight_geometry": {
      const r = highlightGeometry(input as any);
      return { result: r, summary: `highlight ${r.elementIds.join(", ") || "(none)"}` };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
