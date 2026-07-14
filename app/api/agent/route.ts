/**
 * POST /api/agent — streaming (SSE) wrapper over the reasoning core (runAgent).
 *
 * Streams the copilot's live thinking, tool traces (with full payloads the
 * viewer acts on), and the final structured answer/risk/sources. Runs on the
 * Node runtime (reads artifacts from disk, calls the Anthropic + Gemini APIs).
 */

import { runAgent } from "@/lib/agent/loop";
import type { AgentServerEvent } from "@/lib/agent/types";
import type { ClinicalFactors } from "@/lib/agent/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENC = new TextEncoder();
function sse(event: AgentServerEvent): Uint8Array {
  return ENC.encode(`data: ${JSON.stringify(event)}\n\n`);
}
// ~2KB comment padding sent first. Browsers buffer the fetch() body until a
// threshold of bytes arrives before releasing chunks to the reader; this pushes
// past that threshold immediately so events render live (curl doesn't buffer,
// which is why the server "streams" but the browser showed it all at once).
const PADDING = ENC.encode(`: ${" ".repeat(2048)}\n\n`);
const HEARTBEAT = ENC.encode(`: ping\n\n`);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const message: string = body?.message ?? "";
  const caseId: string = body?.caseId ?? "C0001";
  const factors: ClinicalFactors | undefined = body?.factors;

  if (!message.trim()) {
    return new Response(JSON.stringify({ error: "Missing 'message'." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const raw = (bytes: Uint8Array) => {
        if (!closed) {
          try {
            controller.enqueue(bytes);
          } catch {
            closed = true;
          }
        }
      };
      const send = (e: AgentServerEvent) => raw(sse(e));

      // Force the browser to release the stream immediately, then keep it warm.
      raw(PADDING);
      const heartbeat = setInterval(() => raw(HEARTBEAT), 15000);

      // Abort the model run if the client disconnects.
      const ac = new AbortController();
      req.signal.addEventListener("abort", () => ac.abort());

      try {
        const result = await runAgent(message, {
          caseId,
          factors,
          signal: ac.signal,
          onEvent: (e) => send(e),
        });
        send({ type: "answer", content: result.content });
        send({ type: "risk", risk: result.risk });
        send({ type: "sources", sources: result.sources });
        send({ type: "done" });
      } catch (e) {
        send({ type: "error", message: String((e as Error)?.message ?? e) });
      } finally {
        closed = true;
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
