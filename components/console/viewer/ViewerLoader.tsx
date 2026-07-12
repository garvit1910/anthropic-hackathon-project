"use client";

import { useProgress } from "@react-three/drei";

/** Asset-preload overlay so the mesh never shows half-loaded. */
export default function ViewerLoader() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
      </div>
      <div className="num text-xs tracking-widest text-text-lo">
        loading vasculature · {Math.round(progress)}%
      </div>
    </div>
  );
}
