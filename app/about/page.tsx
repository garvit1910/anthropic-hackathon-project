import PageShell from "@/components/PageShell";
import PageHeader from "@/components/PageHeader";
import EnterConsoleLink from "@/components/EnterConsoleLink";

const IS = [
  "Decision support, with the clinician in the loop",
  "A cited, hedged second read on one patient's aneurysm",
  "Transparent about what is computed vs. a labeled proxy",
];
const IS_NOT = [
  "A diagnostic device",
  "A rupture prediction or an autonomous verdict",
  "A replacement for clinical judgment",
];

export default function AboutPage() {
  return (
    <PageShell max="sm">
      <PageHeader
        eyebrow="About"
        title="NeuroVas Copilot"
        lede="An interrogable 3D cerebral-aneurysm copilot: one patient, one aneurysm, one conversation — reasoning over real geometry, blood-flow estimates and the literature, and showing its work on the model the whole time."
      />

      {/* Honesty statement — the load-bearing positioning. */}
      <div className="glass mt-10 rounded-2xl border-l-2 border-l-warn/70 p-6">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
          <h2 className="display text-xs uppercase tracking-widest text-warn">
            Honesty statement
          </h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-text-hi">
          This is decision support, not a verdict. Rupture-risk hemodynamics are
          genuinely contested — the literature associates rupture with both high
          and low wall shear stress. NeuroVas is built to show its reasoning and
          its sources rather than to declare an answer, and it flags every claim
          that rests on that contested science. That honesty is the feature, not
          a caveat.
        </p>
      </div>

      {/* What it is / is not. */}
      <div className="glass mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-2xl sm:grid-cols-2">
        <div className="bg-bg-panel p-6">
          <p className="label !text-accent">What it is</p>
          <ul className="mt-4 space-y-2.5">
            {IS.map((x) => (
              <li key={x} className="flex gap-2 text-sm text-text-hi">
                <span className="text-accent" aria-hidden>✓</span>
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-bg-panel p-6">
          <p className="label !text-warn">What it is not</p>
          <ul className="mt-4 space-y-2.5">
            {IS_NOT.map((x) => (
              <li key={x} className="flex gap-2 text-sm text-text-lo">
                <span className="text-warn" aria-hidden>✕</span>
                {x}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Generalization — the honest version. */}
      <div className="glass mt-6 rounded-2xl p-6">
        <h2 className="display text-xs uppercase tracking-widest text-text-hi">
          Where it generalizes (and where it doesn&rsquo;t)
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-text-lo">
          The reconstruction engine is modality-agnostic: the same volume → mask →
          marching-cubes → mm-world → mesh path that turns a vessel scan into an
          interrogable model turns a tumor scan into one nearly for free — a
          closing flourish, not a second product. What does{" "}
          <span className="text-text-hi">not</span> transfer is the routing:
          catheter navigation is Dijkstra over a 1-D vessel centerline, whereas a
          biopsy-needle trajectory is a near-straight line through 3-D soft
          tissue — a different problem we name, not claim. The aneurysm stays the
          center of gravity, and we are honest about where the machinery actually
          carries over.
        </p>
      </div>

      {/* Data & team. */}
      <div className="glass mt-6 rounded-2xl p-6">
        <h2 className="display text-xs uppercase tracking-widest text-text-hi">
          Data &amp; team
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-text-lo">
          Public datasets only: AneuX (Zenodo 6678442), Aneurisk, the CMHA
          hemodynamics collection (Sci Data 2024), and the Lausanne TOF-MRA
          collection (OpenNeuro ds003949). Built with Claude for the Life
          Sciences track. Full attribution lives on the{" "}
          <a href="/citations" className="link">Citations</a> page.
        </p>
      </div>

      <div className="mt-10">
        <EnterConsoleLink />
      </div>
    </PageShell>
  );
}
