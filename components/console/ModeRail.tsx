"use client";

import { motion } from "framer-motion";
import type { ViewerMode } from "@/types";
import { useConsoleStore } from "@/lib/store";

interface ModeDef {
  key: ViewerMode;
  label: string;
  icon: React.ReactNode;
}

const MODES: ModeDef[] = [
  {
    key: "anatomy",
    label: "Anatomy",
    icon: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  },
  {
    key: "hemodynamics",
    label: "Hemo",
    icon: <path d="M3 12c3-4 6-4 9 0s6 4 9 0M3 17c3-4 6-4 9 0s6 4 9 0" />,
  },
  {
    key: "whatif",
    label: "What-If",
    icon: <><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="9" /></>,
  },
  {
    key: "navigation",
    label: "Nav",
    icon: <path d="M4 20c6 0 4-9 8-9s4 9 8 9M12 3v8" />,
  },
];

export default function ModeRail() {
  const mode = useConsoleStore((s) => s.mode);
  const setMode = useConsoleStore((s) => s.setMode);

  return (
    <nav
      className="glass flex shrink-0 gap-1 border-white/5 p-2 lg:flex-col lg:gap-2 lg:border-r lg:p-3"
      aria-label="Copilot modes"
    >
      {MODES.map((m) => {
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2.5 transition-colors lg:flex-none ${
              active ? "text-accent" : "text-text-lo hover:text-text-hi"
            }`}
            aria-pressed={active}
          >
            {active && (
              <motion.span
                layoutId="mode-active"
                className="absolute inset-0 rounded-xl border border-accent/40 bg-accent/10"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="relative z-10 h-5 w-5"
            >
              {m.icon}
            </svg>
            <span className="relative z-10 text-[10px] font-medium tracking-wide">
              {m.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
