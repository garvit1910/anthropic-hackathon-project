import Link from "next/link";

const LINKS = [
  { href: "/console", label: "Console" },
  { href: "/cases", label: "Cases" },
  { href: "/method", label: "Method" },
  { href: "/about", label: "About" },
];

/** Minimal fixed top nav shared across pages. */
export default function SiteNav({ transparent = false }: { transparent?: boolean }) {
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-4 sm:px-8 ${
        transparent ? "" : "glass"
      }`}
    >
      <Link href="/" className="display text-sm font-bold tracking-widest text-text-hi">
        NEUROVAS<span className="text-accent"> COPILOT</span>
      </Link>
      <nav className="flex items-center gap-1 text-xs sm:gap-2 sm:text-sm">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full px-3 py-1.5 text-text-lo transition-colors hover:bg-white/5 hover:text-text-hi"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
