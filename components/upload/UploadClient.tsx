"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { HERO_CASE_ID } from "@/lib/cases";

/* .nii.gz must sit before .nii/.gz so it wins the suffix match. */
const ACCEPTED_EXTS = [".nii.gz", ".dcm", ".nii", ".vtp", ".mha", ".mhd", ".vtk", ".stl"];
/* <input accept> can't express double extensions — .gz is listed only for picker
   convenience; matchExt below is the authoritative filter (drops bare .gz). */
const INPUT_ACCEPT = ".dcm,.nii,.gz,.vtp,.mha,.mhd,.vtk,.stl";

const FORMATS = [
  { label: "DICOM", exts: ".dcm" },
  { label: "NIfTI", exts: ".nii · .nii.gz" },
  { label: "VTP", exts: ".vtp" },
  { label: "MetaImage", exts: ".mha · .mhd" },
  { label: "VTK legacy", exts: ".vtk" },
  { label: "STL", exts: ".stl" },
];

type FileEntry = {
  id: string;
  name: string;
  size: number;
  ext: string;
  status: "uploading" | "ready";
  progress: number; // 0–100
};

const matchExt = (name: string) =>
  ACCEPTED_EXTS.find((e) => name.toLowerCase().endsWith(e)) ?? null;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-8 w-8"
      aria-hidden
    >
      <path d="M12 15V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8L14 3z" />
      <path d="M14 3v5h4.5" />
    </svg>
  );
}

function FileRow({
  file,
  onRemove,
}: {
  file: FileEntry;
  onRemove: (id: string) => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.18 }}
      className="panel flex items-center gap-3 rounded-md px-3 py-2.5"
    >
      <span className="shrink-0 text-text-lo">
        <FileIcon />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13px] text-text-hi">{file.name}</span>
          <span className="num shrink-0 text-[9px] uppercase text-accent">
            {file.ext.slice(1)}
          </span>
        </div>
        <div className="num mt-0.5 text-[11px] text-text-lo">
          {formatBytes(file.size)}
        </div>
      </div>
      {file.status === "uploading" ? (
        <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full transition-[width] duration-150"
            style={{
              width: `${file.progress}%`,
              background: "var(--accent)",
              boxShadow: "0 0 12px rgba(77,182,201,0.55)",
            }}
          />
        </div>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent"
            style={{ boxShadow: "0 0 8px rgba(77,182,201,0.8)" }}
          />
          <span className="num text-[10px] uppercase tracking-widest text-accent">
            ready
          </span>
        </span>
      )}
      <button
        type="button"
        onClick={() => onRemove(file.id)}
        aria-label={`Remove ${file.name}`}
        className="shrink-0 px-1 text-base leading-none text-text-lo transition-colors hover:text-wss-high"
      >
        ×
      </button>
    </motion.li>
  );
}

/**
 * Imaging intake between the landing hero and the console. The "upload" is a
 * staged demo — files are listed with a short simulated transfer; nothing is
 * read, transmitted, or parsed.
 */
export default function UploadClient() {
  const router = useRouter();
  const params = useSearchParams();
  const caseId = params.get("case") ?? HERO_CASE_ID;
  const demo = params.get("demo");
  // Continue routes into the simulated reconstruction step, which then hands off to /console.
  const processingHref = `/processing?case=${caseId}${demo ? `&demo=${demo}` : ""}`;

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const rejectTimer = useRef<ReturnType<typeof setTimeout>>();
  const routedRef = useRef(false);

  useEffect(() => {
    router.prefetch(processingHref);
  }, [router, processingHref]);

  // One shared ticker drives every simulated transfer — removing a file needs
  // no timer bookkeeping, and late additions just join the loop.
  const anyUploading = files.some((f) => f.status === "uploading");
  useEffect(() => {
    if (!anyUploading) return;
    const id = setInterval(() => {
      setFiles((prev) =>
        prev.map((f) => {
          if (f.status !== "uploading") return f;
          const next = f.progress + 12 + Math.random() * 14;
          return next >= 100
            ? { ...f, progress: 100, status: "ready" }
            : { ...f, progress: next };
        })
      );
    }, 150);
    return () => clearInterval(id);
  }, [anyUploading]);

  useEffect(() => () => clearTimeout(rejectTimer.current), []);

  const flashRejected = (names: string[]) => {
    setRejected(names);
    clearTimeout(rejectTimer.current);
    rejectTimer.current = setTimeout(() => setRejected([]), 4000);
  };

  const addFiles = (list: FileList | File[]) => {
    const accepted: FileEntry[] = [];
    const refused: string[] = [];
    for (const f of Array.from(list)) {
      const ext = f.name ? matchExt(f.name) : null;
      if (!ext) {
        refused.push(`${f.name || "unnamed file"} (unsupported format)`);
        continue;
      }
      const dup = [...files, ...accepted].some(
        (e) => e.name === f.name && e.size === f.size
      );
      if (dup) {
        refused.push(`${f.name} (already added)`);
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        ext,
        status: "uploading",
        progress: 0,
      });
    }
    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
    if (refused.length) flashRejected(refused);
  };

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  const openPicker = () => inputRef.current?.click();

  const allReady = files.length > 0 && !anyUploading;

  const handleContinue = () => {
    if (!allReady || routedRef.current) return;
    routedRef.current = true;
    router.push(processingHref);
  };

  return (
    <div className="flex min-h-[100svh] flex-col bg-bg-deep">
      <header className="glass z-30 flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 text-text-lo hover:text-text-hi">
          <span aria-hidden>←</span>
          <span className="font-hero text-xs font-bold uppercase tracking-[0.16em] text-text-hi">
            NeuroVas Copilot
          </span>
        </Link>
        <span className="num rounded-full border border-hairline px-3 py-1 text-[10px] text-text-lo">
          intake · {caseId}
        </span>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="num text-[10px] uppercase tracking-widest text-accent">
            imaging intake
          </p>
          <h1 className="display mt-2 text-3xl font-semibold text-text-hi">
            Upload imaging data
          </h1>
          <p className="mt-2 text-sm text-text-lo">
            Add this patient&apos;s scan or mesh files to stage the case, then
            continue into the console.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
        >
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload imaging files"
            onClick={openPicker}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPicker();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              // Ignore leave events fired by children so the highlight doesn't flicker.
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`mt-8 cursor-pointer rounded-xl border border-dashed p-10 text-center transition-colors focus:outline-none focus-visible:border-accent/60 ${
              dragOver
                ? "border-accent/60 bg-accent/5"
                : "border-white/15 bg-bg-panel hover:border-white/25"
            }`}
          >
            <div className="pointer-events-none flex flex-col items-center gap-3">
              <span className={dragOver ? "text-accent" : "text-text-lo"}>
                <UploadIcon />
              </span>
              <div>
                <p className="text-sm text-text-hi">Drag &amp; drop imaging files</p>
                <p className="mt-1 text-xs text-text-lo">or</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openPicker();
              }}
              className="glass-hover num mt-4 rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-[11px] text-accent"
            >
              Browse files
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={INPUT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                // Reset so re-picking the same file fires change again.
                e.target.value = "";
              }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16 }}
          className="mt-4 flex flex-wrap items-center gap-1.5"
        >
          <span className="num mr-1 text-[10px] uppercase tracking-widest text-text-lo">
            accepted
          </span>
          {FORMATS.map((f) => (
            <span
              key={f.label}
              className="num rounded border border-hairline bg-white/5 px-2 py-0.5 text-[10px] text-text-lo"
            >
              {f.label} <span className="text-text-lo/60">{f.exts}</span>
            </span>
          ))}
        </motion.div>

        <AnimatePresence>
          {rejected.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="num mt-3 text-[11px] text-wss-high"
            >
              skipped: {rejected.join(", ")}
            </motion.p>
          )}
        </AnimatePresence>

        {files.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span className="num text-[10px] uppercase tracking-widest text-text-lo">
                staged files · {files.length}
              </span>
              {anyUploading && (
                <span className="num text-[10px] text-text-lo">receiving…</span>
              )}
            </div>
            <ul className="mt-2 space-y-2">
              <AnimatePresence initial={false}>
                {files.map((f) => (
                  <FileRow key={f.id} file={f} onRemove={removeFile} />
                ))}
              </AnimatePresence>
            </ul>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24 }}
          className="mt-8 flex flex-col gap-4 border-t border-white/5 pt-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="num max-w-xs text-[10px] text-text-lo/70">
            demo intake — files stay in your browser; nothing is transmitted or
            parsed.
          </p>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!allReady}
            className="num shrink-0 rounded-full border border-accent/40 bg-accent/10 px-8 py-3 text-sm text-accent transition-all hover:border-accent/70 hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-accent/40 disabled:hover:bg-accent/10"
          >
            {anyUploading ? "Preparing…" : "Continue to console →"}
          </button>
        </motion.div>
      </main>
    </div>
  );
}
