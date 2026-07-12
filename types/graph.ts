import type { Vec3 } from "./viewer";

export type GraphNodeType = "inlet" | "bifurcation" | "terminal" | "aneurysm";

export interface GraphNode {
  id: string;
  name: string;
  position: Vec3;
  type: GraphNodeType;
  radiusMm: number;
}

export interface GraphEdge {
  id: string;
  source: string; // GraphNode.id
  target: string; // GraphNode.id
  lengthMm: number;
  avgRadiusMm: number;
  tortuosity: number; // arc length / chord length - 1
  maxAngleDeg: number; // sharpest turn along the edge
  centerline: Vec3[]; // ordered polyline, source -> target
}

/** Contents of graph.json — the networkx abstraction of the vasculature. */
export interface VesselGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
