"use client";

import type { CaseMeta } from "@/types";
import { useConsoleStore } from "@/lib/store";

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
    >
      <span className={`num text-[11px] ${on ? "text-text-hi" : "text-text-lo"}`}>{label}</span>
      <span
        className={`relative h-3.5 w-6 shrink-0 rounded-full transition-colors ${on ? "bg-accent/70" : "bg-white/12"}`}
      >
        <span
          className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform ${on ? "translate-x-3" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}

/**
 * Context-layer controls on the 3D side — additive overlays independent of the
 * analysis mode, so the viewer reads as an instrument you operate, not a static
 * render. Brain hull only appears for cases that ship one.
 */
export default function LayerControls({ caseMeta }: { caseMeta: CaseMeta }) {
  const brainVisible = useConsoleStore((s) => s.brainVisible);
  const graphVisible = useConsoleStore((s) => s.graphVisible);
  const setBrainVisible = useConsoleStore((s) => s.setBrainVisible);
  const setGraphVisible = useConsoleStore((s) => s.setGraphVisible);
  const hasBrain = !!caseMeta.assets.brain;

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-10 w-44 rounded-lg border border-white/10 bg-black/70 p-2 backdrop-blur">
      <div className="num mb-1 px-2 text-[9px] uppercase tracking-[0.18em] text-text-lo">Layers</div>
      {hasBrain && (
        <Toggle label="Brain hull" on={brainVisible} onClick={() => setBrainVisible(!brainVisible)} />
      )}
      <Toggle label="Vessel graph" on={graphVisible} onClick={() => setGraphVisible(!graphVisible)} />
    </div>
  );
}
