"use client";

import { Html, Line } from "@react-three/drei";
import type { Vec3 } from "@/types";
import { PALETTE } from "@/lib/palette";

// drei 8.x types several internal Line props as required; loosen it.
const LeaderLine = Line as unknown as (props: {
  points: Vec3[];
  color?: string | number;
  lineWidth?: number;
  transparent?: boolean;
  opacity?: number;
}) => JSX.Element;

/**
 * A leader-line callout anchored to a geometric feature. This is the primitive
 * behind spatial annotations: a line from the geometry to a floating label.
 */
export default function AnatomyCallout({
  anchor,
  label,
  detail,
  tone = PALETTE.aneurysm,
  offset = [1.6, 1.2, 0],
}: {
  anchor: Vec3;
  label: string;
  detail?: string;
  tone?: string;
  offset?: Vec3;
}) {
  const end: Vec3 = [
    anchor[0] + offset[0],
    anchor[1] + offset[1],
    anchor[2] + offset[2],
  ];
  return (
    <group>
      <LeaderLine
        points={[anchor, end]}
        color={tone}
        lineWidth={1.2}
        transparent
        opacity={0.8}
      />
      <mesh position={anchor}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color={tone} />
      </mesh>
      <Html position={end} center distanceFactor={9} zIndexRange={[20, 0]}>
        <div className="pointer-events-none -translate-y-1/2 translate-x-2 whitespace-nowrap rounded-md border border-white/10 bg-black/70 px-2.5 py-1.5 backdrop-blur">
          <div className="text-[11px] font-semibold text-text-hi">{label}</div>
          {detail && <div className="num text-[10px] text-text-lo">{detail}</div>}
        </div>
      </Html>
    </group>
  );
}
