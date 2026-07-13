"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { CaseMeta } from "@/types";
import { PALETTE } from "@/lib/palette";
import { useConsoleStore } from "@/lib/store";

/**
 * Loads vessel_tree.glb + aneurysm.glb (separate meshes so they style/animate
 * independently), normalizes them into a shared frame, and drives the Anatomy
 * pulse. The aneurysm sits under its own pivot so it pulses (and resizes) about
 * the dome centroid, not the world origin.
 *
 * Hemodynamics mode swaps the aneurysm to its baked per-vertex WSS heatmap
 * (COLOR_0); highlights bump the dome's emissive so Claude's references glow.
 * Spatial callouts are rendered by GeometryAnnotations (a sibling), which shares
 * the exact same transform via CaseSceneProvider.
 */
export default function CaseModel({
  caseMeta,
  reducedMotion,
}: {
  caseMeta: CaseMeta;
  reducedMotion: boolean;
}) {
  const mode = useConsoleStore((s) => s.mode);
  const override = useConsoleStore((s) => s.morphologyOverride);
  const wssFlag = useConsoleStore((s) => s.wssVisible);
  const highlighted = useConsoleStore((s) => s.highlightedElementIds);
  // WSS heatmap shows in hemodynamics mode (manual switch or agent-driven).
  const wssVisible = wssFlag || mode === "hemodynamics";

  const vessel = useGLTF(caseMeta.assets.vesselTree);
  const aneurysm = useGLTF(caseMeta.assets.aneurysm);

  const built = useMemo(() => {
    const vesselObj = vessel.scene.clone(true);
    const aneurysmObj = aneurysm.scene.clone(true);
    const aneurysmMats: THREE.MeshStandardMaterial[] = [];

    vesselObj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        // Rounak's real GLBs ship without normals → lighting is black without this.
        if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(PALETTE.vessel),
          transparent: true,
          opacity: 0.52,
          roughness: 0.35,
          metalness: 0.1,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
      }
    });
    aneurysmObj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(PALETTE.aneurysm),
          emissive: new THREE.Color(PALETTE.aneurysm),
          emissiveIntensity: 0.28,
          roughness: 0.6,
          metalness: 0.0,
        });
        mesh.material = mat;
        aneurysmMats.push(mat);
      }
    });

    // Pivot so the dome pulses/resizes about its own centroid.
    const aBox = new THREE.Box3().setFromObject(aneurysmObj);
    const aCenter = aBox.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.position.copy(aCenter);
    aneurysmObj.position.sub(aCenter);
    pivot.add(aneurysmObj);

    // Normalize the whole case to a ~4.5-unit frame centered at origin
    // (identical to CaseSceneProvider, so overlays register exactly).
    const group = new THREE.Group();
    group.add(vesselObj);
    group.add(pivot);
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = 4.5 / maxDim;
    group.scale.setScalar(s);
    group.position.copy(center).multiplyScalar(-s);

    return { group, pivot, aneurysmMats };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vessel.scene, aneurysm.scene, caseMeta.id]);

  // WSS heatmap (baked COLOR_0) + highlight emphasis on the aneurysm material.
  const domeHighlighted = useMemo(
    () => highlighted.some((h) => h === "aneurysm_dome" || h === "aneurysm_node" || h === "neck"),
    [highlighted],
  );
  useEffect(() => {
    for (const mat of built.aneurysmMats) {
      if (wssVisible) {
        // Show the baked per-vertex WSS ramp; white base so vertex colors read true.
        mat.vertexColors = true;
        mat.color.set("#ffffff");
        mat.emissive.set("#000000");
        mat.emissiveIntensity = 0.0;
      } else {
        mat.vertexColors = false;
        mat.color.set(PALETTE.aneurysm);
        mat.emissive.set(PALETTE.aneurysm);
        mat.emissiveIntensity = domeHighlighted ? 0.75 : 0.28;
      }
      mat.needsUpdate = true;
    }
  }, [built, wssVisible, domeHighlighted]);

  // Anatomy pulse (~0.6 Hz, ±3%) + what-if base scale + a highlight throb.
  const glowRef = useRef(0);
  useFrame(({ clock }) => {
    const pivot = built.pivot;
    if (!pivot) return;
    const base = override ? override.domeSizeMm / caseMeta.maxDiameterMm : 1;
    let scale = base;
    if ((mode === "anatomy" || domeHighlighted) && !reducedMotion) {
      scale *= 1 + 0.03 * Math.sin(clock.getElapsedTime() * 0.6 * Math.PI * 2);
    }
    pivot.scale.setScalar(scale);

    // Subtle emissive throb while highlighted (not in WSS mode).
    if (domeHighlighted && !wssVisible && !reducedMotion) {
      const throb = 0.55 + 0.25 * Math.sin(clock.getElapsedTime() * 2.2);
      for (const mat of built.aneurysmMats) mat.emissiveIntensity = throb;
      glowRef.current = throb;
    }
  });

  // dispose generated materials on unmount / case change
  useEffect(() => {
    const g = built.group;
    return () => {
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          const mat = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
          else mat?.dispose();
        }
      });
    };
  }, [built]);

  return <primitive object={built.group} />;
}
