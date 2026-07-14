import Link from "next/link";
import PageShell from "@/components/PageShell";
import PageHeader from "@/components/PageHeader";
import Tag from "@/components/ui/Tag";
import { CASES, HERO_CASE_ID } from "@/lib/cases";
import type { CaseMeta } from "@/types";

/** Palette-token accent per vascular location (no neon). */
const LOCATION_GLOW: Record<string, string> = {
  ICA: "var(--accent)",
  MCA: "var(--wss-low)",
  AComm: "var(--aneurysm)",
  PComm: "var(--violet)",
  BA: "var(--path)",
  other: "var(--accent)",
};

const STATUS_TONE: Record<string, "aneurysm" | "accent" | "neutral"> = {
  ruptured: "aneurysm",
  unruptured: "accent",
  unknown: "neutral",
};

/**
 * Honest provenance. Only the hero case is a real, contract-passing
 * reconstruction; the others are lightweight public-dataset fixtures that let
 * the viewer render before the full pipeline landed. (See current_status.md.)
 */
const PROVENANCE: Record<string, { label: string; real: boolean }> = {
  HERO_sub013: { label: "TOF-MRA reconstruction", real: true },
};
function provenanceOf(id: string) {
  return PROVENANCE[id] ?? { label: "demo fixture", real: false };
}

function glow(location: string) {
  return LOCATION_GLOW[location] ?? "var(--accent)";
}

function StatRow({ c }: { c: CaseMeta }) {
  return (
    <div className="flex items-center gap-5">
      <div>
        <div className="num text-sm text-text-hi">
          {c.maxDiameterMm.toFixed(1)}
          <span className="text-text-lo"> mm</span>
        </div>
        <div className="label mt-0.5">max Ø</div>
      </div>
      <div>
        <div className="num text-sm text-text-hi">{c.aspectRatio.toFixed(1)}</div>
        <div className="label mt-0.5">aspect</div>
      </div>
    </div>
  );
}

export default function CasesPage() {
  const hero = CASES.find((c) => c.id === HERO_CASE_ID);
  const rest = CASES.filter((c) => c.id !== HERO_CASE_ID);

  return (
    <PageShell max="lg">
      <PageHeader
        eyebrow="Case library"
        title="Choose a patient"
        lede="Each case loads into the console as a live 3D model you can interrogate. Every one is drawn from a public dataset — no private data is used. We flag which are real reconstructions and which are demo fixtures."
      />

      {/* Featured — the real reconstruction. */}
      {hero && (
        <Link
          href={`/console?case=${hero.id}`}
          className="glass glass-hover group relative mt-10 block overflow-hidden rounded-2xl p-6 sm:p-8"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full opacity-60 blur-3xl transition-opacity group-hover:opacity-90"
            style={{ background: `radial-gradient(closest-side, ${glow(hero.location)}, transparent)` }}
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone="accent">★ featured</Tag>
                <Tag tone="accent">✓ {provenanceOf(hero.id).label}</Tag>
                <Tag tone={STATUS_TONE[hero.ruptureStatus]}>{hero.ruptureStatus}</Tag>
              </div>
              <h2 className="display mt-4 text-xl font-semibold text-text-hi sm:text-2xl">
                {hero.label}
              </h2>
              <p className="num mt-1 text-xs text-text-lo">{hero.id}</p>
              <p className="mt-3 text-sm leading-relaxed text-text-lo">
                A full bilateral vessel tree with brain hull, verified catheter
                routes and a baked WSS heatmap — rebuilt from raw {hero.dataset}{" "}
                slices.
              </p>
            </div>
            <div className="flex items-center gap-8 border-t border-hairline pt-5 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
              <StatRow c={hero} />
              <span className="num text-sm text-text-lo transition-colors group-hover:text-accent">
                Enter console →
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* The rest. */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((c) => {
          const prov = provenanceOf(c.id);
          return (
            <Link
              key={c.id}
              href={`/console?case=${c.id}`}
              className="glass glass-hover group relative flex flex-col overflow-hidden rounded-2xl p-5"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-50 blur-2xl transition-opacity group-hover:opacity-80"
                style={{ background: `radial-gradient(closest-side, ${glow(c.location)}, transparent)` }}
              />
              <div className="relative flex items-center justify-between">
                <span className="display rounded-md border border-hairline bg-black/30 px-2 py-1 text-[11px] font-semibold tracking-wider text-text-hi">
                  {c.location}
                  {c.side ? `·${c.side}` : ""}
                </span>
                <Tag tone={STATUS_TONE[c.ruptureStatus]}>{c.ruptureStatus}</Tag>
              </div>

              <h2 className="relative mt-6 text-base font-medium text-text-hi">
                {c.label}
              </h2>
              <p className="num relative mt-1 text-[11px] text-text-lo">{c.id}</p>

              <div className="relative mt-5 flex flex-1 items-end justify-between border-t border-hairline pt-4">
                <StatRow c={c} />
                <span className="num text-xs text-text-lo transition-colors group-hover:text-accent">
                  open →
                </span>
              </div>
              <div className="relative mt-3 flex items-center justify-between text-[10px] text-text-lo/70">
                <span>{c.dataset}</span>
                <span className="tag">{prov.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}
