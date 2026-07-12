import SiteNav from "@/components/SiteNav";
import HeroStage from "@/components/hero/HeroStage";
import CapabilityCards from "@/components/landing/CapabilityCards";
import ConsolePreview from "@/components/landing/ConsolePreview";
import HonestyBanner from "@/components/landing/HonestyBanner";
import EnterConsoleLink from "@/components/EnterConsoleLink";

export default function Home() {
  return (
    <main className="relative bg-black">
      <SiteNav transparent />
      <HeroStage />

      {/* Below the fold */}
      <div className="mx-auto max-w-6xl px-5 pb-28 sm:px-8">
        <section className="pt-20">
          <p className="display text-xs uppercase tracking-[0.35em] text-accent">
            What it does
          </p>
          <h2 className="mt-3 max-w-3xl text-2xl font-semibold text-text-hi sm:text-3xl">
            Four ways to interrogate an aneurysm — each one changes the 3D view.
          </h2>
          <div className="mt-8">
            <CapabilityCards />
          </div>
        </section>

        <section className="pt-24">
          <ConsolePreview />
        </section>

        <section className="pt-16">
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
