import type { Vec3 } from "./viewer";

/** A single baked CFD streamline polyline. */
export interface Streamline {
  id: string;
  points: Vec3[];
  speeds?: number[]; // optional per-point speed (m/s), aligned to points
  seedRegion?: string; // e.g. "inlet", "neck"
}

/** Contents of streamlines.json. */
export type StreamlinesData = Streamline[];
