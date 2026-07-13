import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { CASES } from "@/lib/cases";

const LOCATION_GLOW: Record<string, string> = {
  ICA: "rgba(255,43,209,0.35)",
  MCA: "rgba(0,187,238,0.35)",
  AComm: "rgba(255,77,109,0.4)",
  PComm: "rgba(127,0,255,0.35)",
  BA: "rgba(255,238,0,0.3)",
  other: "rgba(125,143,168,0.3)",
};

const STATUS_STYLE: Record<string, string> = {
  ruptured: "border-aneurysm/50 text-aneurysm",
  unruptured: "border-accent/40 text-accent",
  unknown: "border-white/15 text-text-lo",
};

export default function CasesPage() {
  return (
    <main className="min-h-screen bg-black pt-24">
      <SiteNav />
      <div className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <p className="display text-xs uppercase tracking-[0.35em] text-text-lo">
          Hero cases
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-text-hi">Case gallery</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-lo">
          Select a patient to load into the console. Every case is drawn from a
          public dataset — no private data is used.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CASES.map((c) => (
            <Link
              key={c.id}
              href={`/console?case=${c.id}`}
              className="glass glass-hover group relative overflow-hidden rounded-2xl p-5"
            >
              <div
                className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-70 blur-2xl transition-opacity group-hover:opacity-100"
                style={{ background: `radial-gradient(closest-side, ${LOCATION_GLOW[c.location]}, transparent)` }}
              />
              <div className="relative flex items-center justify-between">
                <span className="display rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[11px] font-semibold tracking-wider text-text-hi">
                  {c.location}
                  {c.side ? `·${c.side}` : ""}
                </span>
                <span
                  className={`num rounded-full border px-2.5 py-0.5 text-[10px] ${STATUS_STYLE[c.ruptureStatus]}`}
                >
                  {c.ruptureStatus}
                </span>
              </div>
              <h2 className="relative mt-16 text-base font-medium text-text-hi">
                {c.label}
              </h2>
              <p className="num relative mt-1 text-[11px] text-text-lo">{c.id}</p>
              <div className="relative mt-4 flex items-center gap-4 border-t border-white/5 pt-3">
                <div>
                  <div className="num text-sm text-text-hi">
                    {c.maxDiameterMm.toFixed(1)}
                    <span className="text-text-lo"> mm</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-text-lo">
                    max Ø
                  </div>
                </div>
                <div>
                  <div className="num text-sm text-text-hi">
                    {c.aspectRatio.toFixed(1)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-text-lo">
                    aspect
                  </div>
                </div>
                <div className="ml-auto text-xs text-text-lo transition-colors group-hover:text-accent">
                  open →
                </div>
              </div>
              <p className="relative mt-3 text-[10px] text-text-lo/70">{c.dataset}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
