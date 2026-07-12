import { Suspense } from "react";
import ConsoleClient from "@/components/console/ConsoleClient";

export default function ConsolePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100svh] items-center justify-center bg-black text-sm text-text-lo">
          loading console…
        </div>
      }
    >
      <ConsoleClient />
    </Suspense>
  );
}
