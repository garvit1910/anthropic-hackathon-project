const TONES: Record<string, string> = {
  neutral: "border-hairline text-text-lo",
  accent: "border-accent/40 text-accent",
  warn: "border-warn/45 text-warn",
  aneurysm: "border-aneurysm/50 text-aneurysm",
  path: "border-path/45 text-path",
  violet: "border-violet/45 text-violet",
};

/**
 * Small mono chip — honesty flags on the landing (live / cited / proxy),
 * status pills on Cases, provenance markers on Method. One shape, tone-keyed.
 */
export default function Tag({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={`num inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] tracking-wide ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
