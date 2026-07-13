"use client";

import { useEffect, useState } from "react";
import type { CaseMeta, WSSStats } from "@/types";

/**
 * Wall-shear-stress legend for hemodynamics mode. Reads the WSS stats sidecar
 * from the case manifest and renders the blue→red ramp with the Pa range, so
 * the baked heatmap on the dome is interpretable.
 */
export default function WssLegend({ caseMeta }: { caseMeta: CaseMeta }) {
  const [wss, setWss] = useState<WSSStats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(caseMeta.assets.manifest, { headers: { "ngrok-skip-browser-warning": "1" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => alive && setWss(m?.wss ?? null))
      .catch(() => alive && setWss(null));
    return () => {
      alive = false;
    };
  }, [caseMeta.assets.manifest]);

  return (
    <div className="glass pointer-events-none absolute bottom-4 right-4 z-10 w-48 rounded-lg p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="num text-[10px] uppercase tracking-widest text-text-lo">Wall shear stress</span>
      </div>
      <div className="wss-ramp h-2 w-full rounded-full" />
      <div className="num mt-1 flex justify-between text-[10px] text-text-lo">
        <span>{wss ? `${wss.minPa} Pa` : "low"}</span>
        <span className="text-text-hi">{wss ? `μ ${wss.meanPa}` : ""}</span>
        <span>{wss ? `${wss.maxPa} Pa` : "high"}</span>
      </div>
      {wss && (
        <div className="num mt-2 flex justify-between border-t border-white/5 pt-2 text-[10px] text-text-lo">
          <span>
            low-shear <span className="text-wss-low">{wss.lowShearAreaPct}%</span>
          </span>
          <span>
            high-shear <span className="text-wss-high">{wss.highShearAreaPct}%</span>
          </span>
        </div>
      )}
    </div>
  );
}
