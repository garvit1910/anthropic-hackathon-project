/** The four copilot modes. Also settable by Claude via the tool loop. */
export type ViewerMode = "anatomy" | "hemodynamics" | "whatif" | "navigation";

export type Vec3 = [number, number, number];

/** What-If sliders. Values are absolute millimetres, not deltas. */
export interface MorphologyOverride {
  domeSizeMm: number;
  neckWidthMm: number;
}

/**
 * A spatial annotation anchored to a geometric feature. Rendered as a drei
 * <Html> label with a leader line to `anchor`. `elementId` resolves through
 * the case manifest (see types/highlight.ts).
 */
export interface SpatialAnnotation {
  id: string;
  elementId: string;
  text: string;
  anchor: Vec3;
  tone?: "accent" | "aneurysm" | "path" | "contested";
}
