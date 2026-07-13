"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import type { CaseManifest, CaseMeta, StreamlinesData, Vec3, VesselGraph } from "@/types";

/** A precomputed catheter route (Rounak's schema, raw absolute-mm frame). */
export interface CatheterRoutes {
  case_id?: string;
  units?: string;
  routes: Array<{
    entry_node: number;
    target_node: number;
    node_path: number[];
    n_hops: number;
    length_mm: number;
    route_points: Vec3[];
  }>;
}

/**
 * Loads the per-case overlay data (graph, streamlines, manifest, catheter routes)
 * and computes the ONE normalization transform the viewer applies to the GLBs —
 * so every overlay maps raw-frame coordinates into the same ~4.5-unit,
 * origin-centered world the meshes live in. The transform is derived from the
 * combined GLB bounding box exactly as CaseModel derives it, so overlays and
 * meshes register perfectly regardless of the source coordinate frame.
 */
interface CaseScene {
  /** Map a raw GLB-frame point to normalized world space. */
  toWorld: (p: Vec3) => Vec3;
  scale: number;
  /** Raw bbox center — apply `scale`/`-center*scale` to align any raw-frame mesh (e.g. brain). */
  center: Vec3;
  /** Dome centroid, already in world space. */
  domeAnchor: Vec3;
  graph: VesselGraph | null;
  streamlines: StreamlinesData | null;
  manifest: CaseManifest | null;
  catheterPaths: CatheterRoutes | null;
}

const CaseSceneContext = createContext<CaseScene | null>(null);

export function useCaseScene(): CaseScene | null {
  return useContext(CaseSceneContext);
}

function useJson<T>(url: string | undefined): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!url) {
      setData(null);
      return;
    }
    let alive = true;
    setData(null);
    fetch(url, { headers: { "ngrok-skip-browser-warning": "1" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setData(j))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [url]);
  return data;
}

export default function CaseSceneProvider({
  caseMeta,
  children,
}: {
  caseMeta: CaseMeta;
  children: React.ReactNode;
}) {
  // Suspends until both GLBs are cached (same instances CaseModel uses).
  const vessel = useGLTF(caseMeta.assets.vesselTree);
  const aneurysm = useGLTF(caseMeta.assets.aneurysm);

  const graph = useJson<VesselGraph>(caseMeta.assets.graph);
  const streamlines = useJson<StreamlinesData>(caseMeta.assets.streamlines);
  const manifest = useJson<CaseManifest>(caseMeta.assets.manifest);
  const catheterPaths = useJson<CatheterRoutes>(caseMeta.assets.catheterPaths);

  const transform = useMemo(() => {
    // Read the bounding box directly off the cached scenes — no cloning (the
    // 30k-vert vessel tree is heavy; CaseModel already keeps the one clone it
    // needs). setFromObject is read-only.
    const box = new THREE.Box3().setFromObject(vessel.scene);
    box.expandByObject(aneurysm.scene);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 4.5 / maxDim;

    const aBox = new THREE.Box3().setFromObject(aneurysm.scene);
    const aCenter = aBox.getCenter(new THREE.Vector3());

    const center: Vec3 = [c.x, c.y, c.z];
    const toWorld = (p: Vec3): Vec3 => [(p[0] - c.x) * scale, (p[1] - c.y) * scale, (p[2] - c.z) * scale];
    const domeAnchor: Vec3 = [(aCenter.x - c.x) * scale, (aCenter.y - c.y) * scale, (aCenter.z - c.z) * scale];

    return { toWorld, scale, center, domeAnchor };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vessel.scene, aneurysm.scene, caseMeta.id]);

  const value: CaseScene = useMemo(
    () => ({ ...transform, graph, streamlines, manifest, catheterPaths }),
    [transform, graph, streamlines, manifest, catheterPaths],
  );

  return <CaseSceneContext.Provider value={value}>{children}</CaseSceneContext.Provider>;
}
