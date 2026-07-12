import type { AneurysmLocation } from "./case";

/**
 * Output of the `get_morphology(case_id)` tool. All lengths in mm, angles in
 * degrees. `elementIds` maps a named morphometric feature to an element_id
 * that resolves through the case manifest, so Claude can cite geometry and
 * the viewer can anchor an annotation to it.
 */
export interface Morphology {
  caseId: string;
  location: AneurysmLocation;
  domeHeightMm: number;
  neckWidthMm: number;
  maxDiameterMm: number;
  aspectRatio: number; // domeHeight / neckWidth
  sizeRatio: number; // maxDiameter / parentVesselDiameter
  nonSphericityIndex: number;
  undulationIndex: number;
  inflowAngleDeg: number;
  parentVesselDiameterMm: number;
  elementIds: Record<string, string>; // feature name -> element_id
}
