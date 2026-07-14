"use client";

import { useEffect, useRef } from "react";
import { registerViewer } from "./copilot/viewerBridge";

/**
 * Embeds Rounak's standalone 3D viewer (his render + his left control panel) as
 * a same-origin iframe. Registers the iframe window with the viewer bridge so
 * the copilot can drive it, and relays his `caseChanged` events up so the
 * copilot re-targets when the user switches case in his panel.
 *
 * The iframe src is fixed at mount (the URL's case) — case sync afterward flows
 * over postMessage, so switching case never reloads the heavy assets.
 */
export default function ViewerFrame({
  initialCase,
  onCaseChange,
}: {
  initialCase: string;
  onCaseChange?: (caseId: string) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data;
      if (!m || typeof m !== "object") return;
      if (m.type === "ready") registerViewer(ref.current?.contentWindow ?? null);
      else if (m.type === "caseChanged" && m.case) onCaseChange?.(m.case);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onCaseChange]);

  return (
    <iframe
      ref={ref}
      title="NeuroVas 3D viewer"
      src={`/viewer.html?case=${encodeURIComponent(initialCase)}&embed=1`}
      className="h-full w-full border-0 bg-black"
      onLoad={() => registerViewer(ref.current?.contentWindow ?? null)}
    />
  );
}
