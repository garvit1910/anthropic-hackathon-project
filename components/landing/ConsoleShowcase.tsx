"use client";

import { motion } from "framer-motion";
import EnterConsoleLink from "@/components/EnterConsoleLink";

/**
 * Full-width preview of the live console, framed as an app window. The image
 * is a CSS background over a gradient fallback, so a missing file degrades to
 * an intentional-looking dark panel rather than a broken-image icon.
 * Drop the screenshot at public/console-preview.png.
 */
export default function ConsoleShowcase() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-px w-6 bg-accent/60" aria-hidden />
            <p className="display text-xs uppercase tracking-[0.35em] text-text-lo">
              The console
            </p>
          </div>
          <h2 className="display mt-4 max-w-xl text-2xl font-semibold tracking-tight text-text-hi sm:text-3xl">
            Cited, hedged reasoning — shown on the model.
          </h2>
        </div>
        <EnterConsoleLink>Open the console →</EnterConsoleLink>
      </div>

      {/* Framed app window. */}
      <figure className="glass relative mt-8 overflow-hidden rounded-2xl">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-[0.08] blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--accent), transparent)" }}
        />
        {/* Chrome bar */}
        <div className="relative flex items-center gap-2 border-b border-hairline px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-aneurysm/70" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-path/70" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-accent/70" aria-hidden />
          <span className="num ml-3 text-[11px] text-text-lo">
            neurovas copilot — /console · HERO_sub013
          </span>
        </div>
        {/* Screenshot (background so a missing file falls back to a gradient) */}
        <div
          role="img"
          aria-label="NeuroVas console: a 3D cerebral vessel model on the left with streaming, cited reasoning and validated risk scores on the right."
          className="aspect-[2880/1548] w-full bg-cover bg-top"
          style={{
            backgroundImage:
              "url('/console-preview.png'), linear-gradient(135deg, var(--bg-elev), var(--bg-panel))",
          }}
        />
      </figure>
      <figcaption className="num mt-3 text-[11px] text-text-lo/70">
        Live console · the 3D view is driven by Claude&rsquo;s tool calls as it
        reasons.
      </figcaption>
    </motion.div>
  );
}
