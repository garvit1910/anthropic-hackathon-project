"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Vec3 } from "@/types";
import { WSS_RAMP } from "@/lib/palette";
import { useCaseScene } from "./CaseSceneProvider";

/* drei 8.x types Line props strictly; loosen to what we use. */
const FlowLine = Line as unknown as (props: {
  points: Vec3[];
  vertexColors?: THREE.Color[];
  lineWidth?: number;
  dashed?: boolean;
  dashSize?: number;
  gapSize?: number;
  transparent?: boolean;
  opacity?: number;
  ref?: React.Ref<unknown>;
}) => JSX.Element;

/** Sample the blue→violet→pink→red WSS ramp at t∈[0,1]. */
function rampColor(t: number): THREE.Color {
  const stops = WSS_RAMP;
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const span = b.t - a.t || 1;
  const local = (t - a.t) / span;
  return new THREE.Color(a.color).lerp(new THREE.Color(b.color), local);
}

/**
 * Baked CFD streamlines rendered as flowing dashed tubes. The dash offset
 * animates so the lines read as directional flow; color runs along the WSS
 * ramp so faster/near-wall segments glow warm.
 */
export default function Streamlines({ reducedMotion }: { reducedMotion: boolean }) {
  const scene = useCaseScene();
  const matRefs = useRef<Array<{ material?: { dashOffset?: number } }>>([]);

  const lines = useMemo(() => {
    if (!scene?.streamlines) return [];
    return scene.streamlines.map((sl) => {
      const pts = sl.points.map((p) => scene.toWorld(p as Vec3));
      const n = pts.length;
      const colors = pts.map((_, i) => rampColor(n > 1 ? i / (n - 1) : 0));
      return { id: sl.id, pts, colors };
    });
  }, [scene]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    for (const r of matRefs.current) {
      if (r?.material && typeof r.material.dashOffset === "number") {
        r.material.dashOffset -= delta * 0.6;
      }
    }
  });

  if (!lines.length) return null;

  return (
    <group>
      {lines.map((l, i) => (
        <FlowLine
          key={l.id}
          ref={(o: unknown) => {
            matRefs.current[i] = o as { material?: { dashOffset?: number } };
          }}
          points={l.pts}
          vertexColors={l.colors}
          lineWidth={2.1}
          dashed
          dashSize={0.28}
          gapSize={0.16}
          transparent
          opacity={0.92}
        />
      ))}
    </group>
  );
}
