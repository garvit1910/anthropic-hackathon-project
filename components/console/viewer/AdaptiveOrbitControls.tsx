"use client";

import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useConsoleStore } from "@/lib/store";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Slow auto-rotate that pauses the moment the user grabs the model and resumes
 * after 3s of idle. While the agent is reasoning, rotation is forced on and
 * sped up so the model "comes alive" as the copilot thinks. Disabled entirely
 * under reduced-motion.
 */
export default function AdaptiveOrbitControls({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) {
  const ref = useRef<any>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reasoningActive = useConsoleStore((s) => s.reasoningActive);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (reducedMotion) {
      c.autoRotate = false;
      return;
    }
    c.autoRotate = true;
    const onStart = () => {
      c.autoRotate = false;
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    const onEnd = () => {
      idleTimer.current = setTimeout(() => {
        if (ref.current) ref.current.autoRotate = true;
      }, 3000);
    };
    c.addEventListener("start", onStart);
    c.addEventListener("end", onEnd);
    return () => {
      c.removeEventListener("start", onStart);
      c.removeEventListener("end", onEnd);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [reducedMotion]);

  // While reasoning: force rotation on and speed it up; settle back afterward.
  useEffect(() => {
    const c = ref.current;
    if (!c || reducedMotion) return;
    if (reasoningActive) {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      c.autoRotate = true;
      c.autoRotateSpeed = 1.8;
    } else {
      c.autoRotateSpeed = 0.6;
    }
  }, [reasoningActive, reducedMotion]);

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enablePan={false}
      enableDamping
      autoRotateSpeed={0.6}
      minDistance={3}
      maxDistance={14}
    />
  );
}
