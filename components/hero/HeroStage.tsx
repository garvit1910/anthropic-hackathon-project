"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import BrainPoster from "./BrainPoster";
import { HERO_CASE_ID, getHeroCase } from "@/lib/cases";

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
          vesselUrl={getHeroCase().assets.vesselTree}
        />
      ))}

      {/* Title + tagline + CTA overlay */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-end pb-[8vh] text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: transitioning ? 0 : 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15 }}
          className="display px-4 font-black leading-none text-[#0be]"
          style={{
            fontSize: "clamp(1.9rem, 7vw, 6.5rem)",
            textShadow: "0px -3px 2px #fff, 0 0 40px rgba(0,187,238,0.35)",
          }}
        >
          NEUROVAS COPILOT
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: transitioning ? 0 : 1 }}
          transition={{ duration: 0.9, delay: 0.5 }}
          className="mt-8 max-w-xl px-6 text-sm text-text-lo sm:text-base"
        >
          An interrogable 3D aneurysm copilot. Ask it why.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: transitioning ? 0 : 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8 }}
          onClick={handleEnter}
          className="pointer-events-auto mt-8 rounded-full border border-accent/50 bg-accent/10 px-7 py-3 text-sm font-medium tracking-wide text-accent backdrop-blur transition-colors hover:bg-accent/20"
        >
          Enter Console →
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: transitioning ? 0 : 0.6 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="mt-10 text-xs uppercase tracking-[0.3em] text-text-lo"
        >
          scroll to explore
        </motion.div>
      </div>

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
