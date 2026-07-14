import type { AgentServerEvent } from "@/lib/agent/types";
import { postToViewer } from "./viewerBridge";

const isFlowQuery = (input: Record<string, unknown>): boolean => {
  const topic = String(input?.topic ?? "").toLowerCase();
  const q = String(input?.query ?? "").toLowerCase();
  const applies = String(input?.applies_to ?? "").toLowerCase();
  return topic === "wss" || applies.includes("wss") || /shear|wss|hemodynam|flow|osi|inflow/.test(q);
};

const showFlow = () => {
  postToViewer({ type: "setWss", on: true });
  postToViewer({ type: "setLayer", id: "t-stream", on: true });
};

/**
 * Translates a streamed agent event into a command for Rounak's embedded viewer
 * (postMessage) — this is what makes his 3D "follow" Claude's reasoning. Returns
 * a short human note (for the tool-trace card) describing the view change.
 */
export function directorHandle(e: AgentServerEvent): string | undefined {
  if (e.type === "tool_call") {
    // Reveal flow/WSS as soon as Claude starts probing hemodynamic evidence.
    if (e.name === "query_literature" && isFlowQuery(e.input)) {
      showFlow();
      return "hemodynamics · WSS heatmap + flow";
    }
    return undefined;
  }

  if (e.type !== "tool_result" || e.status !== "ok") return undefined;
  const r = e.result as any;

  switch (e.name) {
    case "get_morphology":
      // Measuring the aneurysm = identifying it: play the sac-detection sequence (a no-op replay
      // once already found). This also unlocks every downstream analysis layer + the catheter route.
      postToViewer({ type: "findSac" });
      return "detect aneurysm sac";

    case "compute_risk_scores":
      // Frame the sac while the validated scores compute (size/site drive the score).
      postToViewer({ type: "focusAneurysm" });
      return `PHASES ${r?.phases?.total ?? "?"} · ${r?.phases?.fiveYearRuptureRiskPct ?? "?"}% 5-yr`;

    case "highlight_geometry": {
      const mode = String(r?.mode ?? "");
      // Forward the named elements so the viewer flashes them (was dropped before — the whole
      // point of this tool). The mode-driven camera/flow below still runs as a complement.
      const ids = Array.isArray(r?.elementIds) ? (r.elementIds as string[]) : [];
      if (ids.length) postToViewer({ type: "highlight", elementIds: ids, mode, annotation: r?.annotation });
      if (mode === "hemodynamics") {
        showFlow();
        postToViewer({ type: "focusAneurysm" });
        return ids.length ? `hemodynamics · highlight ${ids.join(", ")}` : "hemodynamics · WSS + flow";
      }
      if (mode === "navigation") {
        // findCatheter runs its own camera choreography (wide during the search, frame the
        // route on reveal) — don't also focusAneurysm or it zooms into the sac mid-search.
        postToViewer({ type: "findCatheter" });
        return "navigation · catheter route";
      }
      postToViewer({ type: "focusAneurysm" });
      return ids.length ? `highlight ${ids.join(", ")}` : "focus aneurysm";
    }

    case "find_catheter_path":
      // findCatheter owns the camera (wide search → frame the route); no focusAneurysm here.
      postToViewer({ type: "findCatheter" });
      return r?.feasible ? "catheter route" : "no feasible route";

    case "perturb_morphology":
      postToViewer({ type: "focusAneurysm" });
      return `what-if · dome → ${r?.after?.maxDiameterMm ?? "?"} mm`;

    default:
      return undefined;
  }
}
