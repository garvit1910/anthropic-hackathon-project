"use client";

import { motion } from "framer-motion";

interface Capability {
  title: string;
  blurb: string;
  view?: string; // what it does to the 3D
  tags: string[];
  color: string;
  span: string; // grid span classes
  icon: React.ReactNode;
}

/** The real capability surface — one anchor card + six tool-backed cells. */
const CAPABILITIES: Capability[] = [
  {
    title: "Reads the patient's own numbers",
    blurb:
      "Max diameter, aspect and size ratios, neck width, location — measured from the segmented sac, with the data-provenance tier surfaced and the rupture outcome sealed away from the model.",
    view: "camera frames the sac",
    tags: ["patient-grounded"],
    color: "var(--accent)",
    span: "",
    icon: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="M5 12h14M9 9.5v5M15 9.5v5" />
      </>
    ),
  },
  {
    title: "Cited literature — with the conflicts shown",
    blurb:
      "Semantic search over a 42-chunk evidence index. Every claim carries a source, and the contested high- vs low-WSS rupture science is drawn as a graph where opposing studies visibly pull apart.",
    view: "evidence echoes onto the anatomy",
    tags: ["cited", "contested-aware"],
    color: "var(--violet)",
    span: "sm:col-span-2 lg:col-span-2",
    icon: (
      <>
        <circle cx="6" cy="7" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="12" cy="17" r="2" />
        <path d="M7.6 8.4 10.6 15.4M16.6 7.6 13.4 15.6M8 7h8" />
      </>
    ),
  },
  {
    title: "Validated risk scores, computed live",
    blurb:
      "PHASES and ELAPSS built from this patient as a point-by-point ledger → a 5-year rupture percentage and a growth band, with every assumed input flagged for its sensitivity.",
    tags: ["live", "PHASES · ELAPSS"],
    color: "var(--aneurysm)",
    span: "",
    icon: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
      </>
    ),
  },
  {
    title: "What-if the dome were bigger",
    blurb:
      "Resize the dome or neck and the aspect and size ratios re-derive instantly, then Claude re-reasons. The flow field greys out on purpose — a proxy solved for the old shape is honestly stale for a new one.",
    tags: ["honest-flagged"],
    color: "var(--path)",
    span: "",
    icon: (
      <>
        <circle cx="12" cy="12" r="6" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </>
    ),
  },
  {
    title: "Can a catheter even get there?",
    blurb:
      "Live Dijkstra over the vessel graph, cost weighted by length × tortuosity, with sub-0.35 mm segments treated as impassable. Returns per-segment difficulty and whether caliber actually binds.",
    view: "animated route reveal",
    tags: ["live"],
    color: "var(--path)",
    span: "",
    icon: <path d="M4 20c6 0 4-8 8-8s4 8 8 8M4 20l2-2M20 20l-2-2" />,
  },
  {
    title: "Flow and wall stress on the dome",
    blurb:
      "A wall-shear-stress heatmap and pulsatile streamlines you can read on the sac — labeled for exactly what they are: an analytic Poiseuille proxy, not a CFD solve (real dataset CFD only for the CMHA case).",
    view: "WSS heatmap + flow switch on",
    tags: ["proxy · not CFD"],
    color: "var(--wss-high)",
    span: "sm:col-span-2 lg:col-span-2",
    icon: (
      <path d="M3 12c3-4 6-4 9 0s6 4 9 0M3 17c3-4 6-4 9 0s6 4 9 0M3 7c3-4 6-4 9 0s6 4 9 0" />
    ),
  },
];

function CapCard({ c, i }: { c: Capability; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay: i * 0.06 }}
      className={`glass glass-hover group flex flex-col rounded-2xl p-5 ${c.span}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke={c.color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mb-4 h-7 w-7 shrink-0"
        aria-hidden
      >
        {c.icon}
      </svg>
      <h3 className="display text-sm font-semibold tracking-wide text-text-hi">
        {c.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-text-lo">{c.blurb}</p>
      <div className="mt-4 flex flex-1 flex-col justify-end gap-3">
        {c.view && (
          <p className="num flex items-center gap-1.5 text-[11px] text-text-lo">
            <span style={{ color: c.color }}>→ in 3D</span>
            <span className="text-text-lo/70">{c.view}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {c.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/** Full-width thesis strip carrying the core loop. */
function AnchorStrip() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="glass relative flex flex-col gap-6 overflow-hidden rounded-2xl p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:p-7"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-[0.10] blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--accent), transparent)" }}
      />
      <div className="relative shrink-0">
        <p className="label">The loop</p>
        <h3 className="display mt-3 text-xl font-semibold leading-tight text-text-hi sm:text-2xl">
          One conversation,
          <br className="hidden sm:block" /> shown in three dimensions.
        </h3>
      </div>
      <p className="relative max-w-xl text-sm leading-relaxed text-text-lo">
        Ask in plain language. Claude streams its reasoning, calls tools over
        this patient&rsquo;s real geometry, and{" "}
        <span className="text-text-hi">every call moves the model</span> — the
        camera frames the sac, flow switches on, the catheter search runs. Each
        claim is tied to a specific patient value <em>and</em> a cited source. It
        hedges instead of declaring, and never states the known outcome.
      </p>
      <div className="relative shrink-0 lg:w-52">
        <div className="wss-ramp h-1.5 w-full rounded-full opacity-80" />
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="tag">cited</span>
          <span className="tag">hedged</span>
          <span className="tag">outcome-sealed</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function CapabilityCards() {
  return (
    <div className="space-y-4">
      <AnchorStrip />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-rows-fr lg:grid-flow-dense lg:grid-cols-4">
        {CAPABILITIES.map((c, i) => (
          <CapCard key={c.title} c={c} i={i} />
        ))}
      </div>
    </div>
  );
}
