/**
 * POST /api/agent — thin HTTP wrapper over the reasoning core (runAgent).
 *
 * Built so a later delivery can wire the console copilot straight to it. Not
 * connected to any UI in this build. Runs on the Node runtime (reads artifacts
 * from disk, calls the Anthropic + Gemini APIs).
 */

import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent/loop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const message: string = body?.message ?? "";
    const caseId: string = body?.caseId ?? "C0001";
    if (!message.trim()) {
      return NextResponse.json({ error: "Missing 'message'." }, { status: 400 });
    }
    const result = await runAgent(message, { caseId });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
