import SiteNav from "@/components/SiteNav";

const STAGES = [
  { n: "01", title: "TOF-MRA / CTA scan", detail: "Raw angiographic volume — the patient's actual imaging." },
  { n: "02", title: "Frangi vesselness", detail: "Multi-scale filter that lights up tubular vessel structures." },
  { n: "03", title: "Marching cubes → mesh", detail: "Iso-surface extraction into a watertight surface mesh." },
  { n: "04", title: "VMTK centerline", detail: "Centerlines + local radii along every branch." },
  { n: "05", title: "networkx graph", detail: "Nodes = bifurcations, edges = segments with tortuosity + angle." },
  { n: "06", title: "CFD bake", detail: "Precomputed streamlines + wall-shear-stress, frozen to static assets." },
  { n: "07", title: "Agent tools", detail: "Morphometrics, RAG literature, catheter routing exposed to Claude." },
];

const DATASETS = [
  "AneuX (Zenodo 6678442)",
  "Aneurisk",
  "Nature Sci Data 2024 CTA",
  "Lausanne TOF-MRA (OpenNeuro ds003949)",
];

export default function MethodPage() {
  return (
    <main className="min-h-screen bg-black pt-24">
      <SiteNav />
      <div className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
        <p className="display text-xs uppercase tracking-[0.35em] text-accent">
          Transparency
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-text-hi">
          How a scan becomes a copilot
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-text-lo">
          Every heavy computation happens offline and is baked to static assets.
          The web app never segments, simulates, or runs CFD live — it loads
          geometry + JSON and calls the agent.
        </p>

        <ol className="mt-10 space-y-3">
          {STAGES.map((s, i) => (
            <li
              key={s.n}
              className="glass flex items-start gap-4 rounded-xl p-4"
            >
              <span className="num text-sm text-accent">{s.n}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-text-hi">{s.title}</div>
                <div className="mt-0.5 text-sm text-text-lo">{s.detail}</div>
              </div>
              {i < STAGES.length - 1 && (
                <span className="hidden text-text-lo sm:block">↓</span>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-10 glass rounded-xl p-5">
          <h2 className="display text-xs uppercase tracking-widest text-text-hi">
            Datasets — public only
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DATASETS.map((d) => (
              <li key={d} className="num text-xs text-text-lo">
                · {d}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-text-lo/70">
            Interactive stage artifacts (raw slice, node-link graph, WSS map)
            expand here in the next build.
          </p>
        </div>
      </div>
    </main>
  );
}
