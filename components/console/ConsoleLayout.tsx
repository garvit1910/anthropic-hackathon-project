"use client";

import Link from "next/link";
import type { CaseMeta } from "@/types";
import { useConsoleStore } from "@/lib/store";
import ModeRail from "./ModeRail";
import VesselViewer from "./VesselViewer";
import CopilotPanelPlaceholder from "./CopilotPanelPlaceholder";

function ConsoleHeader({ caseMeta }: { caseMeta: CaseMeta }) {
  const demoMode = useConsoleStore((s) => s.demoMode);
  return (
    <header className="glass z-30 flex items-center justify-between border-b border-white/5 px-4 py-2.5">
      <Link href="/" className="flex items-center gap-2 text-text-lo hover:text-text-hi">
        <span aria-hidden>←</span>
        <span className="display text-xs font-bold tracking-widest text-text-hi">
          NEUROVAS<span className="text-accent"> COPILOT</span>
        </span>
      </Link>
      <div className="hidden items-center gap-3 text-center sm:flex">
        <span className="text-sm font-medium text-text-hi">{caseMeta.label}</span>
        <span className="num text-[10px] text-text-lo">
          {caseMeta.location}
          {caseMeta.side ? `·${caseMeta.side}` : ""} · Ø{caseMeta.maxDiameterMm.toFixed(1)}mm ·
          AR {caseMeta.aspectRatio.toFixed(1)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {demoMode && (
          <span className="num rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] text-accent">
            DEMO
          </span>
        )}
        <Link
          href="/cases"
          className="num rounded-full border border-white/10 px-3 py-1 text-[10px] text-text-lo hover:text-text-hi"
        >
          cases
        </Link>
      </div>
    </header>
  );
}

export default function ConsoleLayout({ caseMeta }: { caseMeta: CaseMeta }) {
  return (
    <div className="flex h-[100svh] flex-col bg-black">
      <ConsoleHeader caseMeta={caseMeta} />
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[76px_1fr_380px]">
        <ModeRail />
        <div className="relative h-[52vh] min-h-0 lg:h-auto">
          <VesselViewer caseMeta={caseMeta} />
        </div>
        <div className="min-h-0 flex-1 lg:flex-none">
          <div className="h-full">
            <CopilotPanelPlaceholder caseMeta={caseMeta} />
          </div>
        </div>
      </div>
    </div>
  );
}
