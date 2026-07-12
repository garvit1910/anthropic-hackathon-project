/**
 * Palette constants mirroring the CSS custom properties in globals.css.
 * Use these anywhere JS/three.js needs a color literal (CSS vars aren't
 * readable from a WebGL material). Keep in sync with :root in globals.css.
 */
export const PALETTE = {
  bgDeep: "#000000",
  vessel: "#ff2bd1",
  aneurysm: "#ff4d6d",
  accent: "#00bbee",
  violet: "#7f00ff",
  path: "#ffee00",
  wssLow: "#2b6cff",
  wssHigh: "#ff3300",
  textHi: "#eaf6ff",
  textLo: "#7d8fa8",
} as const;

/** Blue → red WSS ramp stops (t in [0,1]) — mirrors the .wss-ramp gradient. */
export const WSS_RAMP: Array<{ t: number; color: string }> = [
  { t: 0.0, color: "#2b6cff" },
  { t: 0.35, color: "#7f5bff" },
  { t: 0.6, color: "#ff5ccb" },
  { t: 1.0, color: "#ff3300" },
];

export type PaletteKey = keyof typeof PALETTE;
