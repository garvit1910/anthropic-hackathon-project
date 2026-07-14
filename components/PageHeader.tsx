/**
 * Consistent page header — a tracked eyebrow with an accent tick, a display
 * title, and an optional lede. Replaces the copy-pasted eyebrow/h1/paragraph
 * block that drifted across the secondary pages.
 */
export default function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
}) {
  return (
    <header className="border-b border-hairline pb-8">
      <div className="flex items-center gap-3">
        <span className="h-px w-6 bg-accent/60" aria-hidden />
        <p className="display text-xs uppercase tracking-[0.35em] text-text-lo">
          {eyebrow}
        </p>
      </div>
      <h1 className="display mt-4 text-3xl font-semibold tracking-tight text-text-hi sm:text-4xl">
        {title}
      </h1>
      {lede && (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-lo sm:text-base">
          {lede}
        </p>
      )}
    </header>
  );
}
