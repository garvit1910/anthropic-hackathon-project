"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { HERO_CASE_ID } from "@/lib/cases";

/* Simulated reconstruction stages. These replay the OFFLINE pipeline's provenance —
   nothing runs in the browser. Durations (ms) are tuned so the heavy stages
   (thresholding / morphology / marching-cubes) dwell longest; edit freely. */
type Stage = { label: string; caption: string; ms: number; flag?: boolean };

const STAGES: Stage[] = [
  { label: "Loading TOF-MRA volume",            caption: "nibabel · lausanne/sub-013/brain.nii.gz",                                 ms: 700 },
  { label: "Resampling to isotropic grid",      caption: "scipy.ndimage.zoom · 0.5 mm · trilinear · affine-corrected",             ms: 800 },
  { label: "Thresholding vessel intensity",     caption: "98.5th percentile within brain mask",                                    ms: 1150 },
  { label: "Morphological filtering",           caption: "binary_opening → remove_small_objects ≥400 vox → binary_closing · 9 CC", ms: 1250 },
  { label: "Marching-cubes surface extraction", caption: "skimage.measure.marching_cubes · ~86k verts",                            ms: 1200 },
  { label: "Taubin smoothing + GLB export",     caption: "PyVista shrink-free λ/μ · trimesh → vessel_tree.glb",                    ms: 850 },
  { label: "Aneurysm mesh from manual mask",    caption: "aneurysm_mask.nii.gz → marching_cubes → aneurysm.glb",                   ms: 650 },
  { label: "Skeletonization → polylines",       caption: "3D thinning · radius from EDT · spurs pruned 2 mm",                      ms: 750 },
  { label: "Centerline graph assembly",         caption: "NetworkX · merge_close_nodes · 142 nodes · 2 ICA entries",               ms: 700 },
  { label: "Analytic hemodynamics",             caption: "Poiseuille τ = 4μV/r · OSI/low-shear proxy · streamlines.json",          ms: 700, flag: true },
  { label: "Catheter path planning",            caption: "NetworkX shortest path · ICA → sac · catheter_paths.json",               ms: 600 },
  { label: "Sac morphology",                    caption: "diameter · height · neck · AR · SR → morphology.json",                   ms: 550 },
  { label: "Baking WSS to vertex colors",       caption: "wss.json → COLOR_0 on aneurysm.glb",                                     ms: 600 },
  { label: "Contract validation",               caption: "sanity_check · contracts.validate_case",                                 ms: 400 },
];

const FADE_MS = 500;
const TOTAL = STAGES.reduce((s, x) => s + x.ms, 0);
const ENDS = STAGES.map((_, i) => STAGES.slice(0, i + 1).reduce((s, x) => s + x.ms, 0));

type StageState = "pending" | "active" | "done";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function StageIndicator({ state }: { state: StageState }) {
  if (state === "done") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15">
        <CheckIcon />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="relative h-5 w-5 shrink-0">
        <span className="absolute inset-0 rounded-full border-2 border-white/10" />
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent motion-safe:animate-spin" />
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
      <span className="h-3 w-3 rounded-full border border-white/15" />
    </span>
  );
}

function StageRow({ stage, state }: { stage: Stage; state: StageState }) {
  const labelColor =
    state === "pending" ? "text-text-lo/50" : "text-text-hi";
  const captionColor =
    state === "pending"
      ? "text-text-lo/40"
      : state === "done"
      ? "text-text-lo/70"
      : "text-text-lo";
  return (
    <li
      className={`flex items-start gap-3 rounded-md px-2 py-2 transition-colors ${
        state === "active" ? "bg-white/[0.03]" : ""
      }`}
    >
      <span className="mt-0.5">
        <StageIndicator state={state} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm ${labelColor}`}>{stage.label}</span>
          {stage.flag && (
            <span className="num rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-warn">
              analytic proxy
            </span>
          )}
        </div>
        <div className={`num mt-0.5 text-[11px] ${captionColor}`}>
          {stage.caption}
        </div>
      </div>
    </li>
  );
}

/**
 * Full-screen reconstruction screen shown between the imaging-intake page and the
 * console. It replays the offline pipeline's provenance on a timer, then fades into
 * the 3D console. No segmentation, meshing, or solver runs here — the artifacts are
 * precomputed offline.
 */
export default function ProcessingClient() {
  const router = useRouter();
  const params = useSearchParams();
  const caseId = params.get("case") ?? HERO_CASE_ID;
  const demo = params.get("demo");
  const consoleHref = `/console?case=${caseId}${demo ? `&demo=${demo}` : ""}`;

  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);

  // One requestAnimationFrame clock drives both the bar and the active stage.
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      start ??= t;
      const e = t - start;
      setElapsed(e);
      if (e >= TOTAL) {
        setDone(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Keep the console warm so the hand-off is instant when the sequence ends.
  useEffect(() => {
    router.prefetch(consoleHref);
  }, [router, consoleHref]);

  // Fade the screen out, then navigate.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => router.push(consoleHref), FADE_MS);
    return () => clearTimeout(t);
  }, [done, router, consoleHref]);

  const percent = Math.min(100, (elapsed / TOTAL) * 100);
  const activeIndex = done
    ? STAGES.length
    : ENDS.findIndex((end) => elapsed < end);

  const stateFor = (i: number): StageState =>
    i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";

  return (
    <motion.div
      animate={{ opacity: done ? 0 : 1 }}
      transition={{ duration: FADE_MS / 1000, ease: "easeInOut" }}
      className="flex min-h-[100svh] flex-col bg-bg-deep"
    >
      <header className="glass z-30 flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 text-text-lo hover:text-text-hi">
          <span aria-hidden>←</span>
          <span className="font-hero text-xs font-bold uppercase tracking-[0.16em] text-text-hi">
            NeuroVas Copilot
          </span>
        </Link>
        <span className="num rounded-full border border-hairline px-3 py-1 text-[10px] text-text-lo">
          reconstruction · {caseId}
        </span>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="num text-[10px] uppercase tracking-widest text-accent">
            reconstruction pipeline
          </p>
          <h1 className="display mt-2 text-3xl font-semibold text-text-hi">
            Reconstructing vasculature
          </h1>
          <p className="mt-2 text-sm text-text-lo">
            Replaying this case&apos;s offline imaging pipeline.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between">
            <span className="num text-[10px] uppercase tracking-widest text-text-lo">
              reconstruction
            </span>
            <span className="num text-xs text-accent">{Math.round(percent)}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full"
              style={{
                width: `${percent}%`,
                background: "var(--accent)",
                boxShadow: "0 0 12px rgba(77,182,201,0.55)",
              }}
            />
          </div>
        </motion.div>

        <motion.ul
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="mt-6 space-y-0.5"
        >
          {STAGES.map((stage, i) => (
            <StageRow key={stage.label} stage={stage} state={stateFor(i)} />
          ))}
        </motion.ul>

        <p className="num mt-8 border-t border-white/5 pt-5 text-[10px] text-text-lo/70">
          Artifacts are precomputed offline — this replays the reconstruction
          provenance; no segmentation, meshing, or solver runs in your browser.
        </p>
      </main>
    </motion.div>
  );
}
