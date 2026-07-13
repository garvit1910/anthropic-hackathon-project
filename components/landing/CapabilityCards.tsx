"use client";

import { motion } from "framer-motion";

interface Capability {
  title: string;
  blurb: string;
  color: string;
  icon: React.ReactNode;
}

const CAPABILITIES: Capability[] = [
  {
    title: "Hemodynamics",
    blurb:
      "Baked CFD streamlines and a wall-shear-stress heatmap you can read on the dome.",
    color: "var(--wss-high)",
    icon: (
      <path d="M3 12c3-4 6-4 9 0s6 4 9 0M3 17c3-4 6-4 9 0s6 4 9 0M3 7c3-4 6-4 9 0s6 4 9 0" />
    ),
  },
  {
    title: "What-If Morphology",
    blurb:
      "Resize the dome and neck live — Claude re-reasons about rupture risk on the fly.",
    color: "var(--aneurysm)",
    icon: <><circle cx="12" cy="12" r="7" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  },
  {
    title: "Catheter Navigation",
    blurb:
      "A route planned over the vessel graph, flagging high-tortuosity bifurcations.",
    color: "var(--path)",
    icon: <path d="M4 20c6 0 4-8 8-8s4 8 8 8M4 20l2-2M20 20l-2-2" />,
  },
  {
    title: "Cited Reasoning",
    blurb:
      "Every claim carries its RAG source — and flags the contested WSS↔rupture science.",
    color: "var(--violet)",
    icon: <><path d="M6 4h9l3 3v13H6z" /><path d="M9 9h6M9 13h6M9 17h4" /></>,
  },
];

export default function CapabilityCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CAPABILITIES.map((c, i) => (
        <motion.div
          key={c.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="glass glass-hover rounded-2xl p-5"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke={c.color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mb-4 h-7 w-7"
          >
            {c.icon}
          </svg>
          <h3 className="display text-sm font-semibold tracking-wide text-text-hi">
            {c.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-text-lo">{c.blurb}</p>
        </motion.div>
      ))}
    </div>
  );
}
