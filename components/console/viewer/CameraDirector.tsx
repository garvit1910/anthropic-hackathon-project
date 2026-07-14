"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { Vec3 } from "@/types";
import { useConsoleStore } from "@/lib/store";
import { useCaseScene } from "./CaseSceneProvider";

const VOCAB_TO_ELEMENT: Record<string, string> = {
  aneurysm_dome: "aneurysm_dome",
  neck: "neck_region",
  aneurysm_node: "aneurysm_node",
  entry_node: "inlet",
  parent_vessel: "bifurcation",
};

/**
 * Gently eases the OrbitControls focus toward whatever geometry Claude is
 * currently highlighting, so the camera "looks at" what the reasoning refers to.
 * Never yanks — a slow lerp that reads as intent, not a cut.
 */
export default function CameraDirector({ reducedMotion }: { reducedMotion: boolean }) {
  const scene = useCaseScene();
  const controls = useThree((s) => s.controls) as unknown as {
    target?: THREE.Vector3;
    update?: () => void;
  } | null;
  const highlighted = useConsoleStore((s) => s.highlightedElementIds);

  // Only refocus when Claude actively highlights something — otherwise leave the
  // default framing (the whole vessel tree) alone so the "wow" isn't zoomed past.
  const focus = useMemo<Vec3 | null>(() => {
    if (!scene || !highlighted.length) return null;
    if (scene.manifest) {
      const byId = new Map(scene.manifest.elements.map((e) => [e.id, e]));
      for (const raw of highlighted) {
        const el = byId.get(VOCAB_TO_ELEMENT[raw] ?? raw);
        if (el) return scene.toWorld(el.anchor);
      }
    }
    return scene.domeAnchor;
  }, [scene, highlighted]);

  useFrame((_, delta) => {
    if (reducedMotion || !controls?.target || !focus) return;
    const target = new THREE.Vector3(...focus);
    // Ease at ~1.6/sec, clamped so it never snaps.
    const k = 1 - Math.pow(0.001, Math.min(delta, 0.05) * 1.6);
    controls.target.lerp(target, k);
  });

  return null;
}
