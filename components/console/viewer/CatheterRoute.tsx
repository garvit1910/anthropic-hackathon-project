"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Vec3, VesselGraph } from "@/types";
import { PALETTE } from "@/lib/palette";
import { useCaseScene } from "./CaseSceneProvider";

const RouteLine = Line as unknown as (props: {
  points: Vec3[];
  color?: string | number;
  lineWidth?: number;
  transparent?: boolean;
  opacity?: number;
}) => JSX.Element;

/** BFS shortest-hop path (inlet → aneurysm) — fallback for cases without real routes. */
function findGraphPath(
  graph: VesselGraph,
): { edgeOrder: { edgeId: string; reversed: boolean }[]; nodeOrder: string[] } | null {
  const inlet = graph.nodes.find((n) => n.type === "inlet");
  const target = graph.nodes.find((n) => n.type === "aneurysm");
  if (!inlet || !target) return null;

  const adj = new Map<string, { to: string; edgeId: string; reversed: boolean }[]>();
  for (const e of graph.edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push({ to: e.target, edgeId: e.id, reversed: false });
    adj.get(e.target)!.push({ to: e.source, edgeId: e.id, reversed: true });
  }

  const prev = new Map<string, { from: string; edgeId: string; reversed: boolean }>();
  const seen = new Set<string>([inlet.id]);
  const queue = [inlet.id];
  while (queue.length) {
    const u = queue.shift()!;
    if (u === target.id) break;
    for (const nb of adj.get(u) ?? []) {
      if (seen.has(nb.to)) continue;
      seen.add(nb.to);
      prev.set(nb.to, { from: u, edgeId: nb.edgeId, reversed: nb.reversed });
      queue.push(nb.to);
    }
  }
  if (!prev.has(target.id) && inlet.id !== target.id) return null;

  const edgeOrder: { edgeId: string; reversed: boolean }[] = [];
  const nodeOrder: string[] = [target.id];
  let cur = target.id;
  while (prev.has(cur)) {
    const p = prev.get(cur)!;
    edgeOrder.push({ edgeId: p.edgeId, reversed: p.reversed });
    nodeOrder.push(p.from);
    cur = p.from;
  }
  edgeOrder.reverse();
  nodeOrder.reverse();
  return { edgeOrder, nodeOrder };
}

interface HardNode {
  pos: Vec3;
  label: string;
}
interface RoutePolyline {
  pts: Vec3[];
  primary: boolean;
}

function cumulative(pts: Vec3[]): { cum: number[]; total: number } {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + new THREE.Vector3(...pts[i - 1]).distanceTo(new THREE.Vector3(...pts[i])));
  }
  return { cum, total: cum[cum.length - 1] || 1 };
}

/**
 * Endovascular access route. Prefers the real precomputed routes (both bilateral
 * ICA approaches, verified to reach the sac); falls back to a graph-BFS path.
 * The shortest route is gold + gets the advancing catheter-tip comet; alternates
 * are cyan. Bifurcations along the primary route are flagged.
 */
export default function CatheterRoute({ reducedMotion }: { reducedMotion: boolean }) {
  const scene = useCaseScene();
  const cometRef = useRef<THREE.Mesh>(null);

  const built = useMemo(() => {
    if (!scene) return null;

    // --- Preferred: Rounak's real routes ---
    if (scene.catheterPaths?.routes?.length && scene.graph) {
      const nodeById = new Map(scene.graph.nodes.map((n) => [n.id, n]));
      const routes = [...scene.catheterPaths.routes].sort((a, b) => a.length_mm - b.length_mm);
      const polylines: RoutePolyline[] = routes.map((r, i) => ({
        pts: (r.route_points ?? []).map((p) => scene.toWorld(p as Vec3)),
        primary: i === 0,
      }));

      // Bifurcations on the primary route — spaced out so labels don't overlap.
      const hard: HardNode[] = [];
      const primary = routes[0];
      if (primary) {
        for (const nodeInt of primary.node_path ?? []) {
          const n = nodeById.get(`n${nodeInt}`);
          if (!n || n.type !== "bifurcation" || hard.length >= 3) continue;
          const p = scene.toWorld(n.position);
          const tooClose = hard.some(
            (h) => new THREE.Vector3(...h.pos).distanceTo(new THREE.Vector3(...p)) < 0.4,
          );
          if (!tooClose) hard.push({ pos: p, label: "bifurcation" });
        }
      }

      const primaryPts = polylines[0]?.pts ?? [];
      return { polylines, hard, ...cumulative(primaryPts), pts: primaryPts };
    }

    // --- Fallback: BFS through the graph ---
    if (!scene.graph) return null;
    const path = findGraphPath(scene.graph);
    if (!path) return null;
    const edgeById = new Map(scene.graph.edges.map((e) => [e.id, e]));
    const nodeById = new Map(scene.graph.nodes.map((n) => [n.id, n]));

    const raw: Vec3[] = [];
    for (const step of path.edgeOrder) {
      const e = edgeById.get(step.edgeId);
      if (!e) continue;
      const cl = (step.reversed ? [...e.centerline].reverse() : e.centerline) as Vec3[];
      for (const p of cl) {
        const last = raw[raw.length - 1];
        if (last && last[0] === p[0] && last[1] === p[1] && last[2] === p[2]) continue;
        raw.push(p);
      }
    }
    const pts = raw.map((p) => scene.toWorld(p));
    const hard: HardNode[] = [];
    path.nodeOrder.forEach((nid) => {
      const n = nodeById.get(nid);
      if (n && n.type === "bifurcation" && hard.length < 4) hard.push({ pos: scene.toWorld(n.position), label: "bifurcation" });
    });
    return { polylines: [{ pts, primary: true }] as RoutePolyline[], hard, ...cumulative(pts), pts };
  }, [scene]);

  useFrame(({ clock }) => {
    if (!built || !cometRef.current || !built.pts.length) return;
    const { pts, cum, total } = built;
    const t = reducedMotion ? 1 : (clock.getElapsedTime() * 0.9) % 1.15;
    const target = Math.min(1, t) * total;
    let i = 1;
    while (i < cum.length && cum[i] < target) i++;
    const a = new THREE.Vector3(...pts[Math.max(0, i - 1)]);
    const b = new THREE.Vector3(...pts[Math.min(pts.length - 1, i)]);
    const segLen = cum[Math.min(cum.length - 1, i)] - cum[Math.max(0, i - 1)] || 1;
    const local = (target - cum[Math.max(0, i - 1)]) / segLen;
    cometRef.current.position.copy(a).lerp(b, THREE.MathUtils.clamp(local, 0, 1));
  });

  if (!built) return null;

  return (
    <group>
      {built.polylines.map((r, i) =>
        r.pts.length > 1 ? (
          <RouteLine
            key={i}
            points={r.pts}
            color={r.primary ? PALETTE.path : PALETTE.accent}
            lineWidth={r.primary ? 3 : 1.8}
            transparent
            opacity={r.primary ? 0.9 : 0.5}
          />
        ) : null,
      )}
      {/* advancing catheter tip on the primary route */}
      {built.pts.length > 1 && (
        <mesh ref={cometRef}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color={PALETTE.path} />
        </mesh>
      )}
      {built.hard.map((h, i) => (
        <group key={i} position={h.pos}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.12, 0.018, 12, 28]} />
            <meshBasicMaterial color={PALETTE.accent} />
          </mesh>
          <Html center distanceFactor={8} zIndexRange={[15, 0]}>
            <div className="pointer-events-none -translate-y-4 whitespace-nowrap rounded border border-white/10 bg-black/70 px-1.5 py-0.5 text-[9px] text-text-lo backdrop-blur">
              {h.label}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
