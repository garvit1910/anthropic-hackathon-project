/**
 * Palette constants mirroring the CSS custom properties in globals.css.
 * Use these anywhere JS/three.js needs a color literal (CSS vars aren't
 * readable from a WebGL material). Keep in sync with :root in globals.css.
 *
 * Clinical dark workstation: muted anatomical tones, one teal accent, a
 * scientific WSS ramp — no neon.
 */
export const PALETTE = {
  bgDeep: "#0a0c10",
  vessel: "#b56b7e", // muted anatomical rose
  aneurysm: "#e8663f", // clinical coral — the lesion
  accent: "#4db6c9", // clinical teal
  brain: "#8a90a8",
  violet: "#7f7bd6",
  path: "#e0b23a", // catheter gold
  wssLow: "#2b6cff",
  wssHigh: "#ff4d2e",
  textHi: "#e6edf3",
  textLo: "#8b98a9",
} as const;

/** Blue → red WSS ramp stops (t in [0,1]) — mirrors the .wss-ramp gradient. */
export const WSS_RAMP: Array<{ t: number; color: string }> = [
  { t: 0.0, color: "#2b6cff" },
  { t: 0.38, color: "#6a5bd6" },
  { t: 0.66, color: "#d1655a" },
  { t: 1.0, color: "#ff4d2e" },
];

export type PaletteKey = keyof typeof PALETTE;
