import { Suspense } from "react";
import UploadClient from "@/components/upload/UploadClient";

export const metadata = { title: "Upload imaging — NeuroVas Copilot" };

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100svh] items-center justify-center bg-black text-sm text-text-lo">
          loading intake…
        </div>
      }
    >
      <UploadClient />
    </Suspense>
  );
}
