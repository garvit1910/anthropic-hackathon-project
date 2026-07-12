import type { Vec3 } from "./viewer";
import type { ViewerMode } from "./viewer";

export type ElementKind = "mesh" | "node" | "edge" | "region";

/**
 * One entry in the highlight-to-geometry registry (manifest.json). Maps an
 * element_id that Claude cites to a concrete geometry reference plus a world
 * anchor for anchored annotations.
 */
export interface ElementRef {
  id: string; // element_id
  kind: ElementKind;
  ref: string; // mesh name / GraphNode.id / GraphEdge.id / region key
  label: string;
  anchor: Vec3;
}

/** manifest.json: registry + optional WSS stats sidecar. */
export interface CaseManifest {
  caseId: string;
  elements: ElementRef[];
  wss?: import("./wss").WSSStats;
}

/**
 * Payload pushed by `highlight_geometry(element_ids)` (and mode-switching
 * tools) onto the Zustand event bus. `mode` optionally switches the rail.
 */
export interface HighlightCommand {
  elementIds: string[];
  mode?: ViewerMode;
  annotation?: string;
}
