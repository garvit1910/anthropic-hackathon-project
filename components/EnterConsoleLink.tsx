import Link from "next/link";
import { HERO_CASE_ID } from "@/lib/cases";

/** Direct route into the console on the hero case (below-fold + stub pages). */
export default function EnterConsoleLink({
  children = "Enter Console →",
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/console?case=${HERO_CASE_ID}`}
      className={`inline-flex items-center rounded-full border border-accent/50 bg-accent/10 px-7 py-3 text-sm font-medium tracking-wide text-accent transition-colors hover:bg-accent/20 ${className}`}
    >
      {children}
    </Link>
  );
}
