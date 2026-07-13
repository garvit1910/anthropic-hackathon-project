"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import BrainPoster from "./BrainPoster";
import { HERO_CASE_ID, getCase } from "@/lib/cases";

// BrainHero is client-only WebGL; never SSR it.
const BrainHero = dynamic(() => import("./BrainHero"), { ssr: false });

/**
 * Full-viewport hero. Chooses the WebGL brain vs. the static poster by
 * breakpoint, renders the NEUROVAS COPILOT title, and owns the "Enter Console"
 * resolve-into-vasculature transition + routing.
 */
export default function HeroStage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const routedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    router.prefetch(`/console?case=${HERO_CASE_ID}`);
    return () => mq.removeEventListener("change", update);
  }, [router]);

  const goToConsole = useCallback(() => {
    if (routedRef.current) return;
    routedRef.current = true;
    router.push(`/console?case=${HERO_CASE_ID}`);
  }, [router]);

  const handleEnter = useCallback(() => {
    if (transitioning) return;
    setTransitioning(true);
    if (isMobile) {
      // No WebGL transition on the poster — brief fade then route.
      setTimeout(goToConsole, 650);
    }
    // Desktop: BrainHero plays the transition and calls onTransitionEnd.
  }, [isMobile, transitioning, goToConsole]);

  return (
    <section className="relative h-[100svh] w-full overflow-hidden bg-black">
      {mounted && (isMobile ? <BrainPoster /> : (
        <BrainHero
          startTransition={transitioning}
          onTransitionEnd={goToConsole}
          // Decorative cross-fade target — use a light mesh so the transition
          // stays snappy (the console itself loads the full HERO vasculature).
          vesselUrl={getCase("ANEUX_042").assets.vesselTree}
        />
      ))}

      {/* Title + byline + CTA overlay — centered over the brain */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center">
        {/* legibility scrim so white text reads over the bright brain */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[62vh] w-[86vw] max-w-4xl -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.32) 42%, transparent 72%)",
          }}
        />

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: transitioning ? 0 : 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15 }}
          className="relative font-hero font-medium uppercase text-white"
          style={{
            fontSize: "clamp(1.6rem, 5vw, 4rem)",
            letterSpacing: "0.14em",
            textShadow: "0 2px 30px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.6)",
          }}
        >
          NEUROVAS COPILOT
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: transitioning ? 0 : 1 }}
          transition={{ duration: 0.9, delay: 0.5 }}
          className="relative mt-5 max-w-xl text-sm text-white/85 sm:text-base"
          style={{
            letterSpacing: "0.03em",
            textShadow: "0 1px 14px rgba(0,0,0,0.8)",
          }}
        >
          An interrogable 3D aneurysm copilot. Ask it why.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: transitioning ? 0 : 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8 }}
          onClick={handleEnter}
          className="pointer-events-auto relative mt-9 rounded-full border border-white/25 bg-white/10 px-8 py-3 text-sm font-medium tracking-wide text-white shadow-[0_6px_34px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all hover:border-white/45 hover:bg-white/20"
        >
          Enter Console →
        </motion.button>
      </div>

      {/* scroll hint pinned to the bottom */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: transitioning ? 0 : 0.65 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="pointer-events-none absolute bottom-[6vh] left-1/2 z-20 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-white/60"
      >
        scroll to explore
      </motion.div>

      {/* Mobile has no shader transition — fade the poster to black before routing.
          On desktop the BrainHero fade uniform resolves to vessels, so no scrim. */}
      <AnimatePresence>
        {transitioning && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="pointer-events-none absolute inset-0 z-10 bg-black"
          />
        )}
      </AnimatePresence>
    </section>
  );
}
