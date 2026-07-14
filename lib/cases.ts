import type { CaseMeta } from "@/types";

/** Build the standard asset paths for a case id. */
function assetsFor(id: string, opts: { brain?: boolean; catheterPaths?: boolean } = {}): CaseMeta["assets"] {
  const base = `/cases/${id}`;
  return {
    vesselTree: `${base}/vessel_tree.glb`,
    aneurysm: `${base}/aneurysm.glb`,
    graph: `${base}/graph.json`,
    streamlines: `${base}/streamlines.json`,
    morphology: `${base}/morphology.json`,
    manifest: `${base}/manifest.json`,
    ...(opts.brain ? { brain: `${base}/brain.glb` } : {}),
    ...(opts.catheterPaths ? { catheterPaths: `${base}/catheter_paths.json` } : {}),
  };
}

/**
 * The hero case id, pinned by demo mode and used as the landing → console
 * cross-fade target. This is Rounak's real reconstruction (full bilateral
 * vessel tree + brain hull + verified catheter routes + baked WSS heatmap).
 */
export const HERO_CASE_ID = "HERO_sub013";

/** Registered hero cases. Only public datasets are used. */
export const CASES: CaseMeta[] = [
  {
    id: "HERO_sub013",
    label: "Cerebral aneurysm — full vasculature",
    dataset: "Lausanne TOF-MRA (OpenNeuro ds003949)",
    location: "other",
    maxDiameterMm: 6.2,
    aspectRatio: 1.1,
    ruptureStatus: "unruptured",
    assets: assetsFor("HERO_sub013", { brain: true, catheterPaths: true }),
  },
  {
    id: "ANEUX_042",
    label: "ICA-ophthalmic saccular aneurysm",
    dataset: "AneuX (Zenodo 6678442)",
    location: "ICA",
    side: "R",
    maxDiameterMm: 7.2,
    aspectRatio: 2.1,
    ruptureStatus: "unruptured",
    assets: assetsFor("ANEUX_042"),
  },
  {
    id: "ANEURISK_C0034",
    label: "MCA bifurcation aneurysm",
    dataset: "Aneurisk",
    location: "MCA",
    side: "L",
    maxDiameterMm: 5.4,
    aspectRatio: 1.5,
    ruptureStatus: "unknown",
    assets: assetsFor("ANEURISK_C0034"),
  },
  {
    id: "CTA_2024_017",
    label: "AComm complex aneurysm",
    dataset: "Nature Sci Data 2024 CTA",
    location: "AComm",
    maxDiameterMm: 9.8,
    aspectRatio: 2.8,
    ruptureStatus: "ruptured",
    assets: assetsFor("CTA_2024_017"),
  },
  {
    id: "LAUSANNE_ds003949_08",
    label: "PComm sidewall aneurysm",
    dataset: "Lausanne TOF-MRA (OpenNeuro ds003949)",
    location: "PComm",
    side: "R",
    maxDiameterMm: 4.1,
    aspectRatio: 1.2,
    ruptureStatus: "unruptured",
    assets: assetsFor("LAUSANNE_ds003949_08"),
  },
];

export function getCase(id: string | null | undefined): CaseMeta {
  if (!id) return CASES[0];
  return CASES.find((c) => c.id === id) ?? CASES[0];
}

export function getHeroCase(): CaseMeta {
  return getCase(HERO_CASE_ID);
}
