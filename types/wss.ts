/**
 * Wall shear stress. The per-vertex heatmap is baked directly into
 * aneurysm.glb as a COLOR_0 vertex attribute (blue -> red ramp). These
 * scalar stats live in manifest.json as a sidecar for the legend + risk card.
 */
export interface WSSStats {
  minPa: number;
  maxPa: number;
  meanPa: number;
  lowShearAreaPct: number; // % of dome surface below the low-shear threshold
  highShearAreaPct: number; // % above the high-shear threshold
}
