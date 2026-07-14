import SiteNav from "@/components/SiteNav";
import HeroStage from "@/components/hero/HeroStage";
import CapabilityCards from "@/components/landing/CapabilityCards";
import ConsoleShowcase from "@/components/landing/ConsoleShowcase";
import HonestyBanner from "@/components/landing/HonestyBanner";
import EnterConsoleLink from "@/components/EnterConsoleLink";

export default function Home() {
  return (
    <main className="relative bg-black">
      <SiteNav transparent />
      <HeroStage />

      {/* Below the fold */}
      <div className="mx-auto max-w-6xl px-5 pb-28 sm:px-8">
        {/* The decision it supports — stated before any capability. */}
        <section className="pt-20">
          <div className="flex items-center gap-3">
            <span className="h-px w-6 bg-accent/60" aria-hidden />
            <p className="display text-xs uppercase tracking-[0.35em] text-text-lo">
              Decision support
            </p>
          </div>
          <h2 className="display mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-text-hi sm:text-4xl">
            Treat it now, or watch and wait?
          </h2>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-text-lo sm:text-base">
            An unruptured aneurysm turns up on a scan done for something else, and
            now someone has to decide. Treating it carries real procedural risk;
            leaving it carries rupture risk; and the science that would settle it
            — size, shape, flow — is genuinely contested. NeuroVas turns one
            patient&rsquo;s scan into an interrogable 3D model and cited, hedged
            reasoning: a clinician-in-the-loop second read, not a verdict.
          </p>
        </section>

        {/* What it actually does — the capability bento. */}
        <section className="pt-16">
          <p className="label mb-6">What it does</p>
          <CapabilityCards />
        </section>

        {/* A real look at the console. */}
        <section className="pt-24">
          <ConsoleShowcase />
        </section>

        <section className="pt-24">
          <HonestyBanner />
        </section>

        <section className="flex flex-col items-center gap-5 pt-24 text-center">
          <h2 className="display max-w-2xl text-2xl font-semibold text-text-hi sm:text-3xl">
            See it reason in three dimensions.
          </h2>
          <EnterConsoleLink />
          <p className="num max-w-xl text-xs text-text-lo">
            Built with Claude · Life Sciences · public datasets only (AneuX,
            Aneurisk, Nature Sci Data 2024 CTA, Lausanne TOF-MRA).
          </p>
        </section>
      </div>
    </main>
  );
}
