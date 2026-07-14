/**
 * evidenceGraph — pure geometry + normalization for the literature-evidence
 * constellation. No React here: this is the testable core that turns a turn's
 * `Citation[]` into node positions, contested tethers, and per-source encodings.
 *
 * Layout is deterministic (computed from the data, not a physics sim) so the
 * demo is reliable on stage. The one bit of motion — the contested "tug" — is a
 * framer-motion decoration in the component, not part of this layout.
 */

import type { Citation, LiteratureStance } from "@/lib/agent/types";

export type Direction = "up" | "down" | "mixed";

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/**
 * Reduce a `direction` field to a rupture-risk sign. Handles BOTH the live RAG
 * enum (`increases_risk` / `decreases_risk` / `mixed`) and the hero script's
 * prose arrows (`"high-WSS → rupture↑"`, `"size<7mm → rupture↓"`). Prose is
 * judged by the arrow attached to "rupture", so `"wide-neck → coiling
 * durability↓"` reads as `mixed` (a treatment signal) rather than a false
 * "lowers rupture risk".
 */
export function normalizeDirection(direction: string): Direction {
  const s = (direction || "").toLowerCase();
  if (!s || s.includes("mixed")) return "mixed";
  // Enum form: "increases_risk" / "decreases_risk".
  if (s.includes("increase") && s.includes("risk")) return "up";
  if (s.includes("decrease") && s.includes("risk")) return "down";
  // Prose form: anchor the sign on the rupture token.
  if (s.includes("rupture")) {
    const after = s.match(/rupture[^↑↓a-z]*([↑↓])/);
    if (after) return after[1] === "↑" ? "up" : "down";
    if (/rupture[^.]*(increase|rise|higher|elevat)/.test(s)) return "up";
    if (/rupture[^.]*(decrease|lower|reduc|protect)/.test(s)) return "down";
    if (s.includes("↑")) return "up";
    if (s.includes("↓")) return "down";
  }
  // Non-rupture prose (durability, access, …) is not a rupture-direction signal.
  return "mixed";
}

/** Node color by WSS stance. */
export function stanceColor(stance: LiteratureStance): string {
  switch (stance) {
    case "high-wss":
      return "var(--wss-high)";
    case "low-wss":
      return "var(--wss-low)";
    default:
      return "var(--text-lo)";
  }
}

/** Patient→source edge tint by normalized rupture direction. */
export function directionColor(dir: Direction): string {
  return dir === "up" ? "var(--wss-high)" : dir === "down" ? "var(--wss-low)" : "var(--hairline-strong)";
}

export function relevancePct(score: number): string {
  return `${Math.round(clamp01(score) * 100)}%`;
}

/**
 * Contested opposing pairs — the sources that "tug apart". Group contested
 * sources by topic; within a topic pair a high-wss source with a low-wss one
 * (fallback: opposing normalized direction). These become tension tethers.
 */
export function contestedPairs(sources: Citation[]): [Citation, Citation][] {
  const contested = sources.filter((s) => s.contested);
  const byTopic = new Map<string, Citation[]>();
  for (const s of contested) {
    const arr = byTopic.get(s.topic) ?? [];
    arr.push(s);
    byTopic.set(s.topic, arr);
  }
  const pairs: [Citation, Citation][] = [];
  for (const arr of Array.from(byTopic.values())) {
    const highs = arr.filter((s) => s.stance === "high-wss");
    const lows = arr.filter((s) => s.stance === "low-wss");
    const n = Math.min(highs.length, lows.length);
    for (let i = 0; i < n; i++) pairs.push([highs[i], lows[i]]);
    if (n === 0 && arr.length >= 2) {
      const up = arr.filter((s) => normalizeDirection(s.direction) === "up");
      const down = arr.filter((s) => normalizeDirection(s.direction) === "down");
      const m = Math.min(up.length, down.length);
      for (let i = 0; i < m; i++) pairs.push([up[i], down[i]]);
    }
  }
  return pairs;
}

export interface EvidenceNode {
  source: Citation;
  x: number;
  y: number;
  r: number;
  angle: number; // radians
  cited: boolean;
  direction: Direction;
}

export interface EvidenceTether {
  a: EvidenceNode;
  b: EvidenceNode;
}

export interface EvidenceLayout {
  width: number;
  height: number;
  cx: number;
  cy: number;
  patientR: number;
  nodes: EvidenceNode[];
  tethers: EvidenceTether[];
}

const DEG = Math.PI / 180;
// The contested tug runs on the up-right ↔ down-left diagonal (poles 180° apart,
// so a contested pair spans the patient); neutrals sit on the other diagonal.
const HIGH_POLE = -40 * DEG;
const LOW_POLE = 140 * DEG;
const NEUTRAL_POLE_A = 50 * DEG;
const NEUTRAL_POLE_B = 230 * DEG;
const FAN = 24 * DEG;

/** k angles evenly fanned about a base angle. */
function fan(base: number, k: number): number[] {
  if (k <= 0) return [];
  return Array.from({ length: k }, (_, j) => base + (j - (k - 1) / 2) * FAN);
}

/**
 * Place the patient at center and each source on an orbit: angle by stance pole
 * (high-wss and low-wss diametrically opposite), radius by relevance (more
 * relevant = closer). `citationIds` marks which sources fed the verdict.
 */
export function layoutEvidence(
  sources: Citation[],
  size: { width: number; height: number },
  citationIds: string[] = [],
): EvidenceLayout {
  const { width, height } = size;
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
  const patientR = Math.max(14, minDim * 0.075);
  const Rmax = minDim * 0.42;
  const Rmin = minDim * 0.24;
  const cites = new Set(citationIds);

  const high = sources.filter((s) => s.stance === "high-wss");
  const low = sources.filter((s) => s.stance === "low-wss");
  const neutral = sources.filter((s) => s.stance !== "high-wss" && s.stance !== "low-wss");

  const angleFor = new Map<Citation, number>();
  fan(HIGH_POLE, high.length).forEach((a, i) => angleFor.set(high[i], a));
  fan(LOW_POLE, low.length).forEach((a, i) => angleFor.set(low[i], a));
  // Split neutrals across the two perpendicular poles so they never crowd the WSS axis.
  const nA = neutral.filter((_, i) => i % 2 === 0);
  const nB = neutral.filter((_, i) => i % 2 === 1);
  fan(NEUTRAL_POLE_A, nA.length).forEach((a, i) => angleFor.set(nA[i], a));
  fan(NEUTRAL_POLE_B, nB.length).forEach((a, i) => angleFor.set(nB[i], a));

  const nodes: EvidenceNode[] = sources.map((s) => {
    const angle = angleFor.get(s) ?? 0;
    const rel = clamp01(s.relevanceScore);
    const orbit = Rmax - (Rmax - Rmin) * rel;
    return {
      source: s,
      x: cx + Math.cos(angle) * orbit,
      y: cy + Math.sin(angle) * orbit,
      r: 6 + 7 * rel,
      angle,
      cited: cites.has(s.id),
      direction: normalizeDirection(s.direction),
    };
  });

  const nodeById = new Map(nodes.map((n) => [n.source.id, n]));
  const tethers = contestedPairs(sources)
    .map(([a, b]) => ({ a: nodeById.get(a.id), b: nodeById.get(b.id) }))
    .filter((t): t is EvidenceTether => Boolean(t.a && t.b));

  return { width, height, cx, cy, patientR, nodes, tethers };
}
