"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "@/types";
import { useCaseScene } from "./CaseSceneProvider";

/**
 * Faint centerline skeleton of the whole vessel graph — a context layer that
 * reveals the vasculature's branching structure. All edges are packed into a
 * single LineSegments for cheap rendering.
 */
export default function GraphOverlay() {
  const scene = useCaseScene();

  const geometry = useMemo(() => {
    if (!scene?.graph) return null;
    const positions: number[] = [];
    for (const e of scene.graph.edges) {
      const cl = (e.centerline ?? []) as Vec3[];
      for (let i = 1; i < cl.length; i++) {
        const a = scene.toWorld(cl[i - 1]);
        const b = scene.toWorld(cl[i]);
        positions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    }
    if (!positions.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [scene]);

  if (!geometry) return null;
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#5b6b82" transparent opacity={0.35} />
    </lineSegments>
  );
}
