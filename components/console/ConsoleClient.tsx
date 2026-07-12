"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getCase } from "@/lib/cases";
import { useConsoleStore } from "@/lib/store";
import ConsoleLayout from "./ConsoleLayout";

/** Reads ?case= / ?demo= and seeds the store, then renders the console. */
export default function ConsoleClient() {
  const params = useSearchParams();
  const caseId = params.get("case");
  const demo = params.get("demo") === "1";
  const caseMeta = getCase(caseId);

  const setCase = useConsoleStore((s) => s.setCase);
  const setDemoMode = useConsoleStore((s) => s.setDemoMode);
  const resetViewState = useConsoleStore((s) => s.resetViewState);

  useEffect(() => {
    resetViewState();
    setCase(caseMeta.id);
    setDemoMode(demo);
  }, [caseMeta.id, demo, setCase, setDemoMode, resetViewState]);

  return <ConsoleLayout caseMeta={caseMeta} />;
}
