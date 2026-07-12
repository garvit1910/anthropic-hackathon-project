"use client";

/**
 * Static, WebGL-free hero for phones (<768px). The full BrainHero scene is
 * heavy; below the breakpoint we render this instead (chosen via matchMedia,
 * not user-agent). A CSS glow stands in for the brain so nothing looks
 * half-loaded; a real rendered poster image can drop in later.
 */
export default function BrainPoster({ className }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 h-full w-full overflow-hidden bg-black ${
        className ?? ""
      }`}
      aria-hidden
    >
      {/* layered radial glows evoking the synapse brain */}
      <div
        className="absolute left-1/2 top-1/2 h-[80vw] w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80 blur-2xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(127,0,255,0.55), rgba(255,43,209,0.28) 45%, transparent 72%)",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-[52vw] w-[52vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-xl motion-safe:animate-pulse-soft"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,187,238,0.5), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 50%, transparent 40%, #000 85%)",
        }}
      />
    </div>
  );
}
