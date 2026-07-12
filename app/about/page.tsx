import SiteNav from "@/components/SiteNav";
import EnterConsoleLink from "@/components/EnterConsoleLink";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-black pt-24">
      <SiteNav />
      <div className="mx-auto max-w-3xl px-5 pb-24 sm:px-8">
        <p className="display text-xs uppercase tracking-[0.35em] text-accent">
          About
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-text-hi">
          NeuroVas Copilot
        </h1>

        <div className="glass mt-8 rounded-2xl border-l-2 border-l-[#f5a623]/70 p-6">
          <h2 className="display text-xs uppercase tracking-widest text-[#f5a623]">
            Honesty statement
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-text-hi">
            This is decision support, not a verdict. Rupture-risk hemodynamics
            are genuinely contested — the literature associates rupture with both
            high and low wall shear stress. NeuroVas is built to show its
            reasoning and its sources rather than to declare an answer, and it
            flags every claim that rests on that contested science.
          </p>
        </div>

        <div className="glass mt-6 rounded-2xl p-6">
          <h2 className="display text-xs uppercase tracking-widest text-text-hi">
            Generalizes beyond the brain
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-text-lo">
            The same planning engine routes a biopsy needle to a tumor — swap the
            target and the constraints. The graph abstraction, the cited
            reasoning, and the spatial annotation loop are anatomy-agnostic.
          </p>
        </div>

        <div className="glass mt-6 rounded-2xl p-6">
          <h2 className="display text-xs uppercase tracking-widest text-text-hi">
            Data &amp; team
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-text-lo">
            Public datasets only: AneuX (Zenodo 6678442), Aneurisk, Nature Sci
            Data 2024 CTA, and the Lausanne TOF-MRA collection (OpenNeuro
            ds003949). Team details land here before the demo.
          </p>
        </div>

        <div className="mt-10">
          <EnterConsoleLink />
        </div>
      </div>
    </main>
  );
}
