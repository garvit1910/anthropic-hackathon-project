/**
 * viewerBridge — the postMessage channel between the copilot and Rounak's
 * embedded viewer.html iframe. The agent director calls postToViewer(...) to
 * drive the 3D (focus the sac, toggle WSS / flow / catheter layers, switch case)
 * as it reasons; ViewerFrame registers the iframe window here on load.
 */

export type ViewerMessage =
  | { type: "setCase"; case: string }
  | { type: "focusAneurysm" }
  | { type: "findSac" } // run the animated aneurysm-sac detection (gates every analysis layer + catheter)
  | { type: "findCatheter" } // run the animated catheter-route search (replaces the old t-cath toggle)
  | { type: "setLayer"; id: string; on: boolean }
  | { type: "setWss"; on: boolean }
  | { type: "reset" }
  | { type: "setThinking"; on: boolean } // start/stop the alive reasoning-orbit
  | { type: "settle" } // smooth glide to the hero framing, then hold
  | { type: "highlight"; elementIds: string[]; mode?: string; annotation?: string } // agent highlight_geometry → flash the named 3D elements
  | { type: "highlightEvidence"; topic: string }; // an evidence-graph node click → highlight the matching geometry

let target: Window | null = null;

export function registerViewer(win: Window | null): void {
  target = win;
}

/** The viewer iframe's window — registered ref, or found in the DOM as a fallback
 *  (robust against registration timing / duplicated module chunks in Next dev). */
function viewerWindow(): Window | null {
  if (target) return target;
  if (typeof document === "undefined") return null;
  const el = document.querySelector('iframe[title="NeuroVas 3D viewer"]') as HTMLIFrameElement | null;
  return el?.contentWindow ?? null;
}

export function postToViewer(msg: ViewerMessage): void {
  try {
    viewerWindow()?.postMessage(msg, "*");
  } catch {
    /* iframe not ready — no-op */
  }
}
