"use client";

import { useState } from "react";
import Link from "next/link";
import type { CaseMeta } from "@/types";
import ViewerFrame from "./ViewerFrame";
import CopilotPanel from "./copilot/CopilotPanel";

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

  return (
    <div className="flex h-[100svh] flex-col bg-bg-deep">
      <ConsoleHeader />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[52vh] min-h-0 lg:h-auto lg:flex-1">
          <ViewerFrame initialCase={caseMeta.id} onCaseChange={setActiveCase} />
        </div>
        <div className="min-h-0 flex-1 lg:w-[clamp(440px,34vw,560px)] lg:flex-none">
          <CopilotPanel caseId={activeCase} />
        </div>
      </div>
    </div>
  );
}
