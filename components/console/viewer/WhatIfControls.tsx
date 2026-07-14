"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaseMeta, Morphology } from "@/types";
import { useConsoleStore } from "@/lib/store";

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What-If controls: dome/neck sliders that resize the aneurysm live and
 * recompute aspect ratio + size ratio client-side (the same arithmetic
 * perturb_morphology does), so the number and the visual move together. A
 * "re-assess" action hands the scenario to the copilot for a fresh derivation —
 * and, as the tool does, we flag that the baked hemodynamics no longer apply.
 */
export default function WhatIfControls({ caseMeta }: { caseMeta: CaseMeta }) {
  const [base, setBase] = useState<Morphology | null>(null);
  const override = useConsoleStore((s) => s.morphologyOverride);
  const setMorphologyOverride = useConsoleStore((s) => s.setMorphologyOverride);
  const resetMorphology = useConsoleStore((s) => s.resetMorphology);
  const queueQuestion = useConsoleStore((s) => s.queueQuestion);
  const reasoningActive = useConsoleStore((s) => s.reasoningActive);

  const [dome, setDome] = useState<number>(caseMeta.maxDiameterMm);
  const [neck, setNeck] = useState<number>(caseMeta.maxDiameterMm / (caseMeta.aspectRatio || 1));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(caseMeta.assets.morphology, { headers: { "ngrok-skip-browser-warning": "1" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((m: Morphology | null) => {
        if (!alive || !m) return;
        setBase(m);
        if (!touched && !override) {
          setDome(m.maxDiameterMm);
          setNeck(m.neckWidthMm);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseMeta.assets.morphology]);

  // Push slider values onto the viewer bus so the dome resizes live.
  const commit = (d: number, n: number) => {
    setTouched(true);
    setMorphologyOverride({ domeSizeMm: d, neckWidthMm: n });
  };

  const derived = useMemo(() => {
    if (!base) return null;
    const scale = base.maxDiameterMm > 0 ? dome / base.maxDiameterMm : 1;
    const newHeight = base.domeHeightMm * scale;
    const parentD = base.parentVesselDiameterMm || (base.maxDiameterMm / (base.sizeRatio || 1));
    const ar = neck > 0 ? newHeight / neck : 0;
    const sr = parentD > 0 ? dome / parentD : 0;
    return { baseAR: base.aspectRatio, baseSR: base.sizeRatio, ar: r2(ar), sr: r2(sr) };
  }, [base, dome, neck]);

  const changed = touched && base && (r2(dome) !== r2(base.maxDiameterMm) || r2(neck) !== r2(base.neckWidthMm));

  return (
    <div className="glass absolute left-4 top-4 z-10 w-64 rounded-lg p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="num text-[10px] uppercase tracking-widest text-text-lo">What-if geometry</span>
        {changed && (
          <button
            onClick={() => {
              setTouched(false);
              resetMorphology();
              if (base) {
                setDome(base.maxDiameterMm);
                setNeck(base.neckWidthMm);
              }
            }}
            className="num text-[10px] text-accent hover:text-text-hi"
          >
            reset
          </button>
        )}
      </div>

      <label className="mb-2 block">
        <div className="num mb-1 flex justify-between text-[11px] text-text-lo">
          <span>dome Ø</span>
          <span className="text-text-hi">{r2(dome)} mm</span>
        </div>
        <input
          type="range"
          min={2}
          max={16}
          step={0.1}
          value={dome}
          aria-label="Dome diameter in millimetres"
          onChange={(e) => {
            const d = parseFloat(e.target.value);
            setDome(d);
            commit(d, neck);
          }}
          className="w-full accent-accent"
        />
      </label>

      <label className="mb-2 block">
        <div className="num mb-1 flex justify-between text-[11px] text-text-lo">
          <span>neck width</span>
          <span className="text-text-hi">{r2(neck)} mm</span>
        </div>
        <input
          type="range"
          min={1}
          max={8}
          step={0.1}
          value={neck}
          aria-label="Neck width in millimetres"
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            setNeck(n);
            commit(dome, n);
          }}
          className="w-full accent-accent"
        />
      </label>

      {derived && (
        <div className="num space-y-1 rounded-md border border-white/5 bg-white/[0.02] p-2 text-[11px]">
          <div className="flex justify-between text-text-lo">
            <span>aspect ratio</span>
            <span>
              {r2(derived.baseAR)} <span className="text-text-lo/50">→</span>{" "}
              <span className="text-text-hi">{derived.ar}</span>
            </span>
          </div>
          <div className="flex justify-between text-text-lo">
            <span>size ratio</span>
            <span>
              {r2(derived.baseSR)} <span className="text-text-lo/50">→</span>{" "}
              <span className="text-text-hi">{derived.sr}</span>
            </span>
          </div>
          {changed && (
            <div className="mt-1 border-t border-white/5 pt-1 text-[10px] text-wss-high/90">
              ⚠ hemodynamics invalidated — CFD is geometry-specific
            </div>
          )}
        </div>
      )}

      <button
        disabled={!changed || reasoningActive}
        onClick={() => queueQuestion(`What if the dome were ${r2(dome)} mm and the neck ${r2(neck)} mm — how does the rupture-risk picture change?`)}
        className="glass-hover num mt-2 w-full rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-[11px] text-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {reasoningActive ? "reasoning…" : "re-assess with copilot →"}
      </button>
    </div>
  );
}
