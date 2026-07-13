"use client";

import { useState } from "react";

const CANONICAL = [
  "Will this aneurysm rupture?",
  "Why? Show me the flow.",
  "What if the dome were 6 mm?",
  "How would you get a catheter there?",
];

export default function Composer({
  onSubmit,
  onStop,
  isStreaming,
  showChips,
}: {
  onSubmit: (q: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  showChips: boolean;
}) {
  const [value, setValue] = useState("");

  const send = (q: string) => {
    const t = q.trim();
    if (!t || isStreaming) return;
    onSubmit(t);
    setValue("");
  };

  return (
    <div className="border-t border-white/5 p-3">
      {showChips && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {CANONICAL.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={isStreaming}
              className="glass-hover num rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-text-lo hover:text-text-hi disabled:cursor-not-allowed disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(value);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isStreaming ? "reasoning…" : "Interrogate this aneurysm…"}
          disabled={isStreaming}
          aria-label="Ask the copilot"
          className="num flex-1 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-text-hi placeholder:text-text-lo/60 focus:border-accent/50 focus:outline-none disabled:opacity-60"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="num rounded-full border border-wss-high/40 bg-wss-high/10 px-3 py-2.5 text-[11px] text-wss-high"
            aria-label="Stop reasoning"
          >
            stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            className="num rounded-full border border-accent/40 bg-accent/10 px-3.5 py-2.5 text-[11px] text-accent disabled:opacity-40"
            aria-label="Send"
          >
            ↑
          </button>
        )}
      </form>
    </div>
  );
}
