import SiteNav from "@/components/SiteNav";

const linkClass =
  "text-white underline decoration-white/30 underline-offset-2 transition-colors hover:decoration-white";

export default function CitationsPage() {
  return (
    <main className="min-h-screen bg-black pt-24">
      <SiteNav />
      <div className="mx-auto max-w-3xl px-5 pb-24 sm:px-8">
        <p className="display text-xs uppercase tracking-[0.35em] text-text-lo">
          Attribution
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-text-hi">Citations</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-lo">
          NeuroVas Copilot is built on public datasets and open-source work. The
          sources below are credited in accordance with their terms of use.
        </p>

        {/* 1 — AneuX morphology database */}
        <section className="glass mt-10 rounded-2xl p-6">
          <div className="flex items-baseline gap-3">
            <span className="num text-sm text-white/50">01</span>
            <h2 className="display text-xs uppercase tracking-widest text-text-hi">
              AneuX morphology database
            </h2>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-text-hi">
            NeuroVas Copilot uses data from the AneuX morphology database, an
            open-access, multi-centric database combining data from three European
            projects: the{" "}
            <a href="https://www.aneux.ch" target="_blank" rel="noopener noreferrer" className={linkClass}>
              AneuX project
            </a>
            , the{" "}
            <a href="https://www.aneurist.org" target="_blank" rel="noopener noreferrer" className={linkClass}>
              @neurIST project
            </a>
            , and{" "}
            <a
              href="http://ecm2.mathcs.emory.edu/aneuriskweb/index"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              Aneurisk
            </a>
            .
          </p>

          <p className="mt-3 text-sm leading-relaxed text-text-lo">
            The data is provided &ldquo;as is&rdquo;, without warranties of any
            kind, under the{" "}
            <a
              href="https://creativecommons.org/licenses/by-nc/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              CC BY-NC 4.0
            </a>{" "}
            license.
          </p>

          <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <p className="num text-[10px] uppercase tracking-widest text-text-lo">
              Required citation
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-hi">
              Juchler N, Schilling S, Bijlenga P, Kurtcuoglu V, Hirsch S.{" "}
              <span className="italic">
                Shape trumps size: image-based morphological analysis reveals that
                the 3D shape discriminates intracranial aneurysm disease status
                better than aneurysm size.
              </span>{" "}
              Frontiers in Neurology (2022). DOI:{" "}
              <a
                href="https://doi.org/10.3389/fneur.2022.809391"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                10.3389/fneur.2022.809391
              </a>
            </p>
          </div>
        </section>

        {/* 2 — 3D brain visualization */}
        <section className="glass mt-6 rounded-2xl p-6">
          <div className="flex items-baseline gap-3">
            <span className="num text-sm text-white/50">02</span>
            <h2 className="display text-xs uppercase tracking-widest text-text-hi">
              Landing 3D visualization
            </h2>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-text-hi">
            The animated &ldquo;synapse brain&rdquo; on the landing page is adapted
            from prisoner849&rsquo;s CodePen.
          </p>
          <p className="mt-2 text-sm">
            <a
              href="https://codepen.io/prisoner849/pen/RwjQaeO"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              codepen.io/prisoner849/pen/RwjQaeO
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
