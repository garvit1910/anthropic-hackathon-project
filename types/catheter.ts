import type { Vec3 } from "./viewer";

export type SegmentDifficulty = "low" | "moderate" | "high";

export interface CatheterSegment {
  edgeId: string; // GraphEdge.id traversed
  fromNode: string;
  toNode: string;
  points: Vec3[]; // centerline points for this segment
  tortuosity: number;
  angleDeg: number; // turn angle entering this segment
  difficulty: SegmentDifficulty;
}

/**
 * Output of `find_catheter_path(entry_node, target_node)`. A-star / Dijkstra over
 * graph.json with edge cost = f(tortuosity, angle, length).
 */
export interface CatheterPath {
  entryNode: string;
  targetNode: string;
  feasible: boolean;
  totalLengthMm: number;
  difficultyScore: number; // aggregate 0..1
  segments: CatheterSegment[];
}
