"use client";

import { Fragment, type ReactNode } from "react";
import type { AssistantMessage } from "./useAgentStream";
import ReasoningStream from "./ReasoningStream";
import RiskCard from "./RiskCard";

/** Minimal inline formatter: **bold** and [citation-id] chips. */
function formatInline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]\n]+\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(
        <strong key={k++} className="font-semibold text-text-hi">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(
        <span key={k++} className="num text-[10.5px] text-accent/85">
          {tok}
        </span>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

function RichText({ text }: { text: string }) {
  // Hide anything from the first fenced block onward (the structured JSON).
  const prose = text.split("```")[0].trim();
  if (!prose) return null;
  const paras = prose.split(/\n\n+/);
  return (
    <div className="space-y-2">
      {paras.map((p, i) => (
        <p key={i} className="text-[13px] leading-relaxed text-text-hi/95">
          {p.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {formatInline(line)}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

export default function AssistantTurn({ message }: { message: AssistantMessage }) {
  const answerReady = message.answer.split("```")[0].trim().length > 0;

  return (
    <div className="space-y-2.5" aria-live="polite">
      <ReasoningStream message={message} />

      {message.status === "error" ? (
        <div className="rounded-md border border-wss-high/30 bg-wss-high/5 p-3 text-[12px] text-wss-high/90">
          <div className="label mb-1 text-wss-high/80">copilot error</div>
          {message.error || "The reasoning stream failed."}
          <div className="mt-1 text-[11px] text-text-lo">
            The 3D view stays fully interactive — try again, or check that the agent has an API key.
          </div>
        </div>
      ) : (
        <>
          {answerReady && (
            <div className="border-l-2 border-text-lo/30 pl-3">
              <div className="label mb-1">Answer</div>
              <RichText text={message.answer} />
            </div>
          )}
          {message.risk && <RiskCard risk={message.risk} sources={message.sources} />}
        </>
      )}
    </div>
  );
}
