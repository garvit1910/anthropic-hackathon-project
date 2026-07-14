import SiteNav from "@/components/SiteNav";

const MAX: Record<string, string> = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
};

/**
 * Standard secondary-page frame: fixed nav, a deep graphite field with one
 * restrained accent glow, and a centered content column. Every non-landing
 * page renders through this so spacing and background stay identical.
 */
export default function PageShell({
  children,
  max = "md",
}: {
  children: React.ReactNode;
  max?: "sm" | "md" | "lg";
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg-deep pt-24">
      <SiteNav />
      {/* One subtle clinical-teal wash, top-right — no neon. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[38rem] w-[38rem] rounded-full opacity-[0.07] blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--accent), transparent)" }}
      />
      <div className={`relative mx-auto ${MAX[max]} px-5 pb-28 sm:px-8`}>
        {children}
      </div>
    </main>
  );
}
