"use client";

import { useMemo } from "react";
import type { CaseMeta, Vec3 } from "@/types";
import { PALETTE } from "@/lib/palette";
import { useConsoleStore } from "@/lib/store";
import { useCaseScene } from "./CaseSceneProvider";
import AnatomyCallout from "./AnatomyCallout";

/** highlight_geometry vocabulary → manifest element id. */
const VOCAB_TO_ELEMENT: Record<string, string> = {
  aneurysm_dome: "aneurysm_dome",
  neck: "neck_region",
  aneurysm_node: "aneurysm_node",
  entry_node: "inlet",
  parent_vessel: "bifurcation",
};

const TONE_COLOR: Record<string, string> = {
  accent: PALETTE.accent,
  aneurysm: PALETTE.aneurysm,
  path: PALETTE.path,
  contested: PALETTE.violet,
};

/**
 * Anchored spatial annotations. When Claude highlights geometry, this resolves
 * each element id through the manifest and draws a leader-line callout — tying
 * a statement in the reasoning panel to the exact structure it refers to.
 * Falls back to a resting dome label in anatomy mode.
 */
export default function GeometryAnnotations({ caseMeta }: { caseMeta: CaseMeta }) {
  const scene = useCaseScene();
  const mode = useConsoleStore((s) => s.mode);
  const highlighted = useConsoleStore((s) => s.highlightedElementIds);
  const annotations = useConsoleStore((s) => s.annotations);

  const annById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of annotations) if (a.text) m.set(a.elementId, a.text);
    return m;
  }, [annotations]);

  const callouts = useMemo(() => {
    if (!scene?.manifest) return [];
    const byId = new Map(scene.manifest.elements.map((e) => [e.id, e]));

    // Agent-driven highlights take priority.
    if (highlighted.length) {
      const out: { key: string; anchor: Vec3; label: string; detail?: string; tone: string }[] = [];
      const seen = new Set<string>();
      for (const raw of highlighted) {
        const elId = VOCAB_TO_ELEMENT[raw] ?? raw;
        const el = byId.get(elId);
        if (!el || seen.has(elId)) continue;
        seen.add(elId);
        out.push({
          key: elId,
          anchor: scene.toWorld(el.anchor),
          label: el.label,
          detail: annById.get(raw) ?? annById.get(elId),
          tone: elId.includes("aneurysm") || elId.includes("dome") ? PALETTE.aneurysm : PALETTE.accent,
        });
      }
      return out;
    }

    // Resting default: dome label in anatomy mode.
    if (mode === "anatomy") {
      const loc = caseMeta.location && caseMeta.location !== "other" ? `${caseMeta.location} ` : "";
      return [
        {
          key: "dome-default",
          anchor: scene.domeAnchor,
          label: `${loc}aneurysm dome`,
          detail: `Ø ${caseMeta.maxDiameterMm.toFixed(1)} mm · AR ${caseMeta.aspectRatio.toFixed(1)}`,
          tone: PALETTE.aneurysm,
        },
      ];
    }
    return [];
  }, [scene, highlighted, annById, mode, caseMeta]);

  // Standalone annotations carrying their own anchor (rare; agent may add later).
  const freeAnnotations = useMemo(
    () => annotations.filter((a) => Array.isArray(a.anchor) && a.text && !VOCAB_TO_ELEMENT[a.elementId]),
    [annotations],
  );

  if (!callouts.length && !freeAnnotations.length) return null;

  return (
    <group>
      {callouts.map((c) => (
        <AnatomyCallout key={c.key} anchor={c.anchor} label={c.label} detail={c.detail} tone={c.tone} />
      ))}
      {freeAnnotations.map((a) => (
        <AnatomyCallout
          key={a.id}
          anchor={scene ? scene.toWorld(a.anchor) : a.anchor}
          label={a.text}
          tone={a.tone ? TONE_COLOR[a.tone] : PALETTE.accent}
        />
      ))}
    </group>
  );
}
