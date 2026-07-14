import Link from "next/link";
import { HERO_CASE_ID } from "@/lib/cases";

/** Routes into the console on the hero case via the imaging-intake step (below-fold + stub pages). */
export default function EnterConsoleLink({
  children = "Enter Console →",
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/upload?case=${HERO_CASE_ID}`}
      className={`inline-flex items-center rounded-full border border-white/25 bg-white/10 px-8 py-3 text-sm font-medium tracking-wide text-white shadow-[0_6px_34px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all hover:border-white/45 hover:bg-white/20 ${className}`}
    >
      {children}
    </Link>
  );
}
