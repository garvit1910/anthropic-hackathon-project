import PageShell from "@/components/PageShell";
import PageHeader from "@/components/PageHeader";
import Tag from "@/components/ui/Tag";

type Tone = "accent" | "path" | "warn" | "neutral";

const OFFLINE: { n: string; title: string; detail: string; tag: string; tone: Tone }[] = [
  {
    n: "01",
    title: "Patient scan",
    detail:
      "A public TOF-MRA or CTA volume — the patient's actual angiographic imaging.",
    tag: "input",
    tone: "neutral",
  },
  {
    n: "02",
    title: "Vessel surface",
    detail:
      "Frangi vesselness lights up tubular structures; marching cubes lifts an iso-surface into a watertight mesh, voxel → mm via the scan affine.",
    tag: "computed",
    tone: "accent",
  },
  {
    n: "03",
    title: "Centerline → graph",
    detail:
      "The centerline is parsed when the dataset ships one (Aneurisk) or skeletonized otherwise, then abstracted: nodes are bifurcations, edges carry length, radius, tortuosity and a dense polyline.",
    tag: "computed",
    tone: "accent",
  },
  {
    n: "04",
    title: "Morphometry",
    detail:
      "A neck-plane fit over the sac mesh yields max diameter, dome height, neck width, aspect and size ratios. Clinical fields (age / sex / outcome) stay in the dataset CSV and never reach the model.",
    tag: "computed",
    tone: "accent",
  },
  {
    n: "05",
    title: "Flow bake",
    detail:
      "An analytic Poiseuille proxy — streamlines advected along graph paths, WSS/OSI from vessel radii, painted onto the dome. Flagged in the data as “not a CFD solve.” Real dataset CFD exists for one case (CMHA).",
    tag: "proxy",
    tone: "warn",
  },
];

const TOOLS: { name: string; detail: string }[] = [
  { name: "get_morphology", detail: "Reads the sac's numbers, surfaces the provenance tier, seals the outcome." },
  { name: "query_literature", detail: "RAG over a 42-chunk evidence index; cited, stance-tagged sources." },
  { name: "compute_risk_scores", detail: "PHASES + ELAPSS as a live point ledger → 5-yr rupture %." },
  { name: "find_catheter_path", detail: "Dijkstra over the graph; length × tortuosity; sub-0.35 mm impassable." },
  { name: "perturb_morphology", detail: "What-if resize; re-derives AR/SR; invalidates stale hemodynamics." },
  { name: "highlight_geometry", detail: "Drives the 3D viewer — flashes the element Claude is discussing." },
];

const COMPUTED = [
  "TOF-MRA → 3D vessel surface (marching cubes)",
  "Centerline → graph, tortuosity, node typing",
  "Aneurysm sac detection (centerline deviation)",
  "Size morphometrics from the sac mesh",
  "Catheter routing — live Dijkstra over the graph",
  "RAG retrieval (Gemini embeddings + cosine)",
  "PHASES / ELAPSS arithmetic + what-if perturbation",
  "Claude's reasoning, grounding and hedging",
];

const PROXY = [
  "WSS / OSI / streamlines — analytic proxy for every case except CMHA",
  "Raw surface geometry & centerlines (parsed from datasets)",
  "Clinical age / sex / rupture / location (dataset CSVs)",
  "CMHA's real CFD hemodynamics (computed by the dataset authors)",
  "The drawn catheter polyline (baked offline)",
];

const DATASETS = [
  "AneuX (Zenodo 6678442)",
  "Aneurisk (GitHub mirror)",
  "CMHA — Nature Sci Data 2024 CTA",
  "Lausanne TOF-MRA (OpenNeuro ds003949)",
];

function LaneLabel({ children, tone }: { children: React.ReactNode; tone: Tone }) {
  const dot =
    tone === "path" ? "bg-path" : tone === "warn" ? "bg-warn" : "bg-accent";
  return (
    <div className="mb-5 flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      <p className="label !text-text-hi">{children}</p>
    </div>
  );
}

export default function MethodPage() {
  return (
    <PageShell max="lg">
      <PageHeader
        eyebrow="Transparency"
        title="How a scan becomes a copilot"
        lede="Every heavy computation happens offline and is baked to static assets. The web app never segments, simulates, or runs CFD live — it loads geometry and JSON, then reasons over it. Here is exactly what runs where, and what is genuinely computed versus a labeled proxy."
      />

      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Offline lane — a connected timeline. */}
        <div>
          <LaneLabel tone="accent">Offline · baked once</LaneLabel>
          <ol className="relative ml-3 border-l border-hairline">
            {OFFLINE.map((s) => (
              <li key={s.n} className="relative pb-6 pl-6 last:pb-0">
                <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border border-accent/60 bg-bg-deep" aria-hidden />
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="num text-xs text-text-lo">{s.n}</span>
                      <span className="text-sm font-medium text-text-hi">{s.title}</span>
                    </div>
                    <Tag tone={s.tone}>{s.tag}</Tag>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-text-lo">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 ml-3 pl-6">
            <p className="num text-[11px] text-text-lo/70">
              → vessel_tree.glb · aneurysm.glb · graph.json · streamlines.json ·
              wss.json · morphology.json · catheter_paths.json
            </p>
          </div>
        </div>

        {/* Live lane — the six agent tools. */}
        <div>
          <LaneLabel tone="path">Live · per question</LaneLabel>
          <div className="glass rounded-xl p-5">
            <p className="text-sm leading-relaxed text-text-lo">
              Claude reasons over the baked artifacts through six tools, streaming
              its thinking and moving the 3D model as it goes.
            </p>
            <ul className="mt-4 space-y-3">
              {TOOLS.map((t) => (
                <li key={t.name} className="flex flex-col gap-1 border-t border-hairline pt-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-baseline sm:gap-3">
                  <span className="num shrink-0 text-xs text-path sm:w-44">{t.name}</span>
                  <span className="text-sm text-text-lo">{t.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Honesty split. */}
      <div className="mt-14">
        <LaneLabel tone="warn">What is real vs. a labeled proxy</LaneLabel>
        <div className="glass grid grid-cols-1 gap-px overflow-hidden rounded-2xl sm:grid-cols-2">
          <div className="bg-bg-panel p-6">
            <p className="label !text-accent">Genuinely computed by our code</p>
            <ul className="mt-4 space-y-2.5">
              {COMPUTED.map((c) => (
                <li key={c} className="flex gap-2 text-sm text-text-hi">
                  <span className="text-accent" aria-hidden>✓</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-bg-panel p-6">
            <p className="label !text-warn">Labeled proxy / dataset-provided</p>
            <ul className="mt-4 space-y-2.5">
              {PROXY.map((p) => (
                <li key={p} className="flex gap-2 text-sm text-text-lo">
                  <span className="text-warn" aria-hidden>≈</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-text-lo/80">
          The reasoning, graph and geometry story is real computation; the
          flow/physics story is an honest analytic proxy for every case but CMHA.
          The copilot is required to surface that provenance rather than pass a
          proxy off as a solve.
        </p>
      </div>

      {/* Datasets. */}
      <div className="mt-14">
        <LaneLabel tone="accent">Datasets — public only</LaneLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DATASETS.map((d) => (
            <div key={d} className="glass rounded-xl px-4 py-3">
              <span className="num text-xs text-text-lo">{d}</span>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
