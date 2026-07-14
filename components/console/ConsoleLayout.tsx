"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { CaseMeta } from "@/types";
import ViewerFrame from "./ViewerFrame";
import CopilotPanel from "./copilot/CopilotPanel";

const COPILOT_W_KEY = "neurovas.copilotW";
const COPILOT_W_DEFAULT = 500;
const COPILOT_W_MIN = 360;
const COPILOT_W_MAX = 760;

const clampCopilotW = (w: number) => Math.min(COPILOT_W_MAX, Math.max(COPILOT_W_MIN, w));

function ConsoleHeader() {
  return (
    <header className="glass z-30 flex items-center justify-between border-b border-hairline px-4 py-2.5">
      <Link href="/" className="flex items-center gap-2 text-text-lo hover:text-text-hi">
        <span aria-hidden>←</span>
        <span className="font-hero text-xs font-bold uppercase tracking-[0.16em] text-text-hi">
          NeuroVas Copilot
        </span>
      </Link>
      <Link
        href="/cases"
        className="num rounded-full border border-hairline px-3 py-1 text-[10px] text-text-lo hover:text-text-hi"
      >
        cases
      </Link>
    </header>
  );
}

/**
 * Console = Rounak's embedded 3D viewer (his left control panel + render) in the
 * middle, the reasoning copilot on the right. The copilot drives the viewer over
 * postMessage as it reasons; switching case in his panel re-targets the copilot.
 */
export default function ConsoleLayout({ caseMeta }: { caseMeta: CaseMeta }) {
  const [activeCase, setActiveCase] = useState(caseMeta.id);

  // Desktop-only resizable split between the 3D viewer and the copilot. On mobile
  // the two stack (flex-col) and the width override is ignored.
  const [copilotW, setCopilotW] = useState(COPILOT_W_DEFAULT);
  const [isDesktop, setIsDesktop] = useState(false);
  const [dragging, setDragging] = useState(false);
  // State, not a ref: on mount the persistence effect must SKIP its first run (before
  // hydration commits) so it never clobbers a saved width with the SSR default.
  const [hydrated, setHydrated] = useState(false);

  // Hydrate persisted width + track the lg breakpoint (matches Tailwind's 1024px).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const syncMq = () => setIsDesktop(mq.matches);
    syncMq();
    mq.addEventListener("change", syncMq);

    const saved = Number(window.localStorage.getItem(COPILOT_W_KEY));
    if (Number.isFinite(saved) && saved > 0) setCopilotW(clampCopilotW(saved));
    setHydrated(true);

    return () => mq.removeEventListener("change", syncMq);
  }, []);

  // Persist width once hydrated so we never clobber storage with the SSR default.
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(COPILOT_W_KEY, String(copilotW));
  }, [copilotW, hydrated]);

  // While dragging, listen on window so the pointer keeps driving the split even as
  // it travels over the 3D iframe (the transparent overlay below keeps the iframe
  // from swallowing the move events).
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) =>
      setCopilotW(clampCopilotW(window.innerWidth - e.clientX));
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  const startDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex h-[100svh] flex-col bg-bg-deep"
    >
      <ConsoleHeader />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[52vh] min-h-0 lg:h-auto lg:flex-1">
          <ViewerFrame initialCase={caseMeta.id} onCaseChange={setActiveCase} />
        </div>

        {isDesktop && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize copilot panel"
            onPointerDown={startDrag}
            className={`group relative hidden w-1.5 shrink-0 cursor-col-resize transition-colors lg:block ${
              dragging ? "bg-accent" : "bg-hairline hover:bg-accent"
            }`}
          >
            {/* fat invisible hit-area so the 1.5px bar is easy to grab */}
            <span className="absolute inset-y-0 -left-2 -right-2" />
          </div>
        )}

        <div
          className="min-h-0 flex-1 lg:w-[500px] lg:flex-none"
          style={isDesktop ? { width: copilotW, flex: "none" } : undefined}
        >
          <CopilotPanel caseId={activeCase} />
        </div>
      </div>

      {/* During a drag, this overlay sits above the iframe and captures the pointer
          so the drag stays smooth over the 3D canvas. */}
      {dragging && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none" />
      )}
    </motion.div>
  );
}
