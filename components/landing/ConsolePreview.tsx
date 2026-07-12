"use client";

import { motion } from "framer-motion";

/**
 * Placeholder for a ~20s looping console screen-capture. Drop a real
 * <video>/GIF in here later; for now it's a labeled framed slot so the
 * layout is final.
 */
export default function ConsolePreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className="glass relative aspect-video w-full overflow-hidden rounded-2xl"
    >
      {/* faux console chrome */}
      <div className="absolute inset-0 grid grid-cols-[64px_1fr_240px] opacity-60">
        <div className="border-r border-white/5 bg-white/[0.02]" />
        <div
          className="relative"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 50%, rgba(255,43,209,0.14), transparent 70%)",
          }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md motion-safe:animate-pulse-soft"
            style={{ background: "radial-gradient(closest-side, rgba(255,77,109,0.6), transparent)" }}
          />
        </div>
        <div className="border-l border-white/5 bg-white/[0.02]" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="num rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs text-text-lo backdrop-blur">
          console capture — coming soon
        </span>
      </div>
    </motion.div>
  );
}
