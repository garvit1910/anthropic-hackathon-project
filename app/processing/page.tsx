import { Suspense } from "react";
import ProcessingClient from "@/components/processing/ProcessingClient";

export const metadata = { title: "Reconstructing — NeuroVas Copilot" };

export default function ProcessingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100svh] items-center justify-center bg-black text-sm text-text-lo">
          loading…
        </div>
      }
    >
      <ProcessingClient />
    </Suspense>
  );
}
