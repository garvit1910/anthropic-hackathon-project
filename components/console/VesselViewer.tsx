"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import type { CaseMeta } from "@/types";
import { PALETTE } from "@/lib/palette";
import { useConsoleStore } from "@/lib/store";
import CaseModel from "./viewer/CaseModel";
import AdaptiveOrbitControls from "./viewer/AdaptiveOrbitControls";
import ViewerLoader from "./viewer/ViewerLoader";
import ViewerErrorBoundary from "./viewer/ViewerErrorBoundary";

const MODE_LABEL: Record<string, string> = {
  anatomy: "Anatomy",
  hemodynamics: "Hemodynamics",
  whatif: "What-If",
  navigation: "Navigation",
};

function StaticFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-center">
      <div
        className="h-24 w-24 rounded-full blur-md"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,77,109,0.55), transparent)",
        }}
      />
      <p className="text-sm text-text-lo">3D context was lost.</p>
      <button
        onClick={onRetry}
        className="rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs text-accent hover:bg-accent/20"
      >
        Restore view
      </button>
    </div>
  );
}

export default function VesselViewer({ caseMeta }: { caseMeta: CaseMeta }) {
  const reduced = !!useReducedMotion();
  const mode = useConsoleStore((s) => s.mode);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    // Warm the cache so the loader resolves quickly.
    useGLTF.preload(caseMeta.assets.vesselTree);
    useGLTF.preload(caseMeta.assets.aneurysm);
  }, [caseMeta]);

  return (
    <div className="relative h-full w-full bg-black">
      {contextLost ? (
        <StaticFallback onRetry={() => setContextLost(false)} />
      ) : (
        <ViewerErrorBoundary>
          <Canvas
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            camera={{ fov: 45, position: [0, 0, 7], near: 0.1, far: 100 }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener("webglcontextlost", (e) => {
                e.preventDefault();
                setContextLost(true);
              });
            }}
          >
            <ambientLight intensity={0.65} />
            <directionalLight position={[5, 6, 8]} intensity={1.1} />
            {/* cyan rim light for depth; no post-processing bloom on anatomy */}
            <directionalLight position={[-6, -3, -5]} intensity={0.5} color={PALETTE.accent} />
            <Suspense fallback={null}>
              <CaseModel caseMeta={caseMeta} reducedMotion={reduced} />
            </Suspense>
            <AdaptiveOrbitControls reducedMotion={reduced} />
          </Canvas>
        </ViewerErrorBoundary>
      )}

      <ViewerLoader />

      {/* mode badge */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent shadow-glow" />
        <span className="num text-xs uppercase tracking-widest text-text-lo">
          {MODE_LABEL[mode] ?? mode} mode
        </span>
      </div>
    </div>
  );
}
