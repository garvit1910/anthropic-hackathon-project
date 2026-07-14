"use client";

import { useState } from "react";
import {
  POLL_QUESTIONS,
  DEFAULT_FACTORS,
  factorsFromSelections,
  selectionsFromFactors,
  type ClinicalFactors,
} from "@/lib/agent/scoring";

/**
 * AssumptionsPoll — the copilot asks the clinician for the 4 factors it cannot
 * measure from the scan (population, hypertension, earlier SAH, shape). Answers
 * feed the REAL PHASES/ELAPSS computation. Controlled local state → onSubmit,
 * modelled on WhatIfControls' input→action pattern. Defaults preselect the safe
 * values, so one click reproduces the baseline.
 */
export default function AssumptionsPoll({
  defaults = DEFAULT_FACTORS,
  onSubmit,
}: {
  defaults?: ClinicalFactors;
  onSubmit: (factors: ClinicalFactors) => void;
}) {
  const [sel, setSel] = useState<Record<string, string>>(() => selectionsFromFactors(defaults));
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (submitted) return;
    setSubmitted(true);
    onSubmit(factorsFromSelections(sel));
  };

  return (
    <div className="glass rounded-lg border-l-2 border-accent/50 p-3.5">
      <div className="num text-[10px] uppercase tracking-widest text-accent">clinical factors needed</div>
      <p className="mt-1 text-[12px] leading-snug text-text-lo">
        To finalise the validated scores I need four factors the scan can&apos;t give me. Confirm or adjust — the
        defaults reproduce a low-risk baseline.
      </p>

      <div className="mt-3 space-y-3">
        {POLL_QUESTIONS.map((q) => (
          <div key={q.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-medium text-text-hi">{q.label}</span>
              <span className="num hidden text-[9.5px] text-text-lo/60 sm:inline">{q.hint}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {q.options.map((o) => {
                const active = sel[q.key] === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    disabled={submitted}
                    onClick={() => setSel((s) => ({ ...s, [q.key]: o.value }))}
                    aria-pressed={active}
                    className={`num rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      active
                        ? "border-accent/60 bg-accent/15 text-text-hi"
                        : "border-white/10 text-text-lo hover:border-white/25 hover:text-text-hi"
                    } ${submitted ? "opacity-60" : ""}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={submitted}
        className="mt-3.5 w-full rounded-md border border-accent/40 bg-accent/15 py-1.5 text-[12px] font-semibold text-text-hi transition-colors hover:bg-accent/25 disabled:opacity-60"
      >
        {submitted ? "computing…" : "Compute scores & finalise"}
      </button>
    </div>
  );
}
