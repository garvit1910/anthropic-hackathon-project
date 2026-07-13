import type { AgentServerEvent } from "@/lib/agent/types";
import type { ViewerMode } from "@/types";
import { useConsoleStore } from "@/lib/store";

const MODE_MAP: Record<string, ViewerMode> = {
  anatomy: "anatomy",
  hemodynamics: "hemodynamics",
  whatif: "whatif",
  navigation: "navigation",
};

const isFlowQuery = (input: Record<string, unknown>): boolean => {
  const topic = String(input?.topic ?? "").toLowerCase();
  const q = String(input?.query ?? "").toLowerCase();
  const applies = String(input?.applies_to ?? "").toLowerCase();
  return topic === "wss" || applies.includes("wss") || /shear|wss|hemodynam|flow|osi|inflow/.test(q);
};

/**
 * Translates a streamed agent event into a viewer state change — this is what
 * makes the 3D "follow" Claude's reasoning. Returns a short human note (for the
 * tool-trace card) describing the view change, if any.
 */
export function directorHandle(e: AgentServerEvent): string | undefined {
  const s = useConsoleStore.getState();

  if (e.type === "tool_call") {
    // Nudge to hemodynamics as soon as Claude starts probing flow/WSS evidence.
    if (e.name === "query_literature" && isFlowQuery(e.input)) {
      s.setMode("hemodynamics");
      s.setStreamlinesVisible(true);
      s.setWssVisible(true);
      return "hemodynamics · streamlines + WSS";
    }
    return undefined;
  }

  if (e.type !== "tool_result" || e.status !== "ok") return undefined;
  const r = e.result as any;

  switch (e.name) {
    case "highlight_geometry": {
      const ids: string[] = Array.isArray(r?.elementIds) ? r.elementIds : [];
      const mode = r?.mode && MODE_MAP[r.mode] ? MODE_MAP[r.mode] : undefined;
      s.applyHighlightCommand({ elementIds: ids, mode });
      if (r?.annotation && ids.length) {
        s.setAnnotations([{ id: `ann-${ids.join("-")}`, elementId: ids[0], text: r.annotation, anchor: [0, 0, 0] }]);
      }
      const modeNote = mode ? `${mode} · ` : "";
      return `${modeNote}highlight ${ids.join(", ") || "(none)"}`;
    }
    case "get_morphology": {
      s.setMode("anatomy");
      s.setHighlights(["aneurysm_dome"]);
      return "anatomy · dome highlighted";
    }
    case "find_catheter_path": {
      s.setMode("navigation");
      s.setHighlights(["entry_node", "aneurysm_node"]);
      return r?.feasible ? "navigation · route traced" : "navigation · no feasible route";
    }
    case "perturb_morphology": {
      s.setMode("whatif");
      const after = r?.after;
      if (after && typeof after.maxDiameterMm === "number") {
        s.setMorphologyOverride({
          domeSizeMm: after.maxDiameterMm,
          neckWidthMm: typeof after.neckWidthMm === "number" ? after.neckWidthMm : s.morphologyOverride?.neckWidthMm ?? 0,
        });
      }
      return `what-if · dome → ${after?.maxDiameterMm ?? "?"} mm`;
    }
    default:
      return undefined;
  }
}
