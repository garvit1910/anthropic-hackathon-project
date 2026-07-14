"use client";

import { motion } from "framer-motion";

/** The load-bearing honesty statement. Prominent, not buried. */
export default function HonestyBanner() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className="glass rounded-2xl border-l-2 border-l-warn/70 p-6"
    >
      <div className="flex items-start gap-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--warn)"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 h-6 w-6 shrink-0"
          aria-hidden
        >
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
        <p className="text-sm leading-relaxed text-text-hi sm:text-base">
          <span className="font-semibold text-warn">
            Decision support, not a verdict.
          </span>{" "}
          Rupture-risk hemodynamics are contested — studies associate rupture
          with both high <em>and</em> low wall shear stress. This tool shows its
          reasoning rather than declaring an answer.
        </p>
      </div>
    </motion.div>
  );
}
