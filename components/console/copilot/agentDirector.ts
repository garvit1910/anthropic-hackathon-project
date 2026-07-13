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
      postToViewer({ type: "focusAneurysm" });
      return "focus aneurysm";

    case "highlight_geometry": {
      const mode = String(r?.mode ?? "");
      if (mode === "hemodynamics") {
        showFlow();
        postToViewer({ type: "focusAneurysm" });
        return "hemodynamics · WSS + flow";
      }
      if (mode === "navigation") {
        postToViewer({ type: "setLayer", id: "t-cath", on: true });
        postToViewer({ type: "focusAneurysm" });
        return "navigation · catheter route";
      }
      postToViewer({ type: "focusAneurysm" });
      return "focus aneurysm";
    }

    case "find_catheter_path":
      postToViewer({ type: "setLayer", id: "t-cath", on: true });
      postToViewer({ type: "focusAneurysm" });
      return r?.feasible ? "catheter route" : "no feasible route";

    case "perturb_morphology":
      postToViewer({ type: "focusAneurysm" });
      return `what-if · dome → ${r?.after?.maxDiameterMm ?? "?"} mm`;

    default:
      return undefined;
  }
}
