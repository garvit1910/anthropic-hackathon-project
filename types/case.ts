export type AneurysmLocation =
  | "ICA"
  | "MCA"
  | "AComm"
  | "PComm"
  | "BA"
  | "other";

export type RuptureStatus = "ruptured" | "unruptured" | "unknown";

/** Static asset paths (public/) for a single case. */
export interface CaseAssets {
  vesselTree: string; // /cases/{id}/vessel_tree.glb
  aneurysm: string; // /cases/{id}/aneurysm.glb
  graph: string; // /cases/{id}/graph.json
  streamlines: string; // /cases/{id}/streamlines.json
  morphology: string; // /cases/{id}/morphology.json
  manifest: string; // /cases/{id}/manifest.json
  brain?: string; // /cases/{id}/brain.glb — optional translucent context hull
  catheterPaths?: string; // /cases/{id}/catheter_paths.json — precomputed real routes
}

/** Gallery-level metadata for a hero case. */
export interface CaseMeta {
  id: string; // e.g. "ANEUX_042"
  label: string; // human display name
  dataset: string; // source dataset (public only)
  location: AneurysmLocation;
  side?: "L" | "R";
  maxDiameterMm: number;
  aspectRatio: number;
  ruptureStatus: RuptureStatus;
  thumbnail?: string;
  assets: CaseAssets;
}
