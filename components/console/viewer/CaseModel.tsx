"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { CaseMeta, Vec3 } from "@/types";
import { PALETTE } from "@/lib/palette";
import { useConsoleStore } from "@/lib/store";
import AnatomyCallout from "./AnatomyCallout";

/**
 * Loads vessel_tree.glb + aneurysm.glb (separate meshes so they style/animate
 * independently), normalizes them into a shared frame, and drives the Anatomy
 * pulse. The aneurysm sits under its own pivot so it pulses (and later resizes)
 * about the dome centroid, not the world origin.
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

  const vessel = useGLTF(caseMeta.assets.vesselTree);
  const aneurysm = useGLTF(caseMeta.assets.aneurysm);

  const built = useMemo(() => {
    const vesselObj = vessel.scene.clone(true);
    const aneurysmObj = aneurysm.scene.clone(true);

    vesselObj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(PALETTE.vessel),
          transparent: true,
          opacity: 0.55,
          roughness: 0.4,
          metalness: 0.0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
      }
    });
    aneurysmObj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(PALETTE.aneurysm),
          emissive: new THREE.Color(PALETTE.aneurysm),
          emissiveIntensity: 0.28,
          roughness: 0.6,
          metalness: 0.0,
        });
      }
    });

    // Pivot so the dome pulses/resizes about its own centroid.
    const aBox = new THREE.Box3().setFromObject(aneurysmObj);
    const aCenter = aBox.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.position.copy(aCenter);
    aneurysmObj.position.sub(aCenter);
    pivot.add(aneurysmObj);

    // Normalize the whole case to a ~4.5-unit frame centered at origin.
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

    // Dome anchor in world space (group is the only transform above it).
    const domeAnchor: Vec3 = [
      (aCenter.x - center.x) * s,
      (aCenter.y - center.y) * s,
      (aCenter.z - center.z) * s,
    ];

    return { group, pivot, domeAnchor };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vessel.scene, aneurysm.scene, caseMeta.id]);

  // Anatomy pulse (~0.6 Hz, ±3%) + what-if base scale.
  useFrame(({ clock }) => {
    const pivot = built.pivot;
    if (!pivot) return;
    const base = override ? override.domeSizeMm / caseMeta.maxDiameterMm : 1;
    let scale = base;
    if (mode === "anatomy" && !reducedMotion) {
      scale *= 1 + 0.03 * Math.sin(clock.getElapsedTime() * 0.6 * Math.PI * 2);
    }
    pivot.scale.setScalar(scale);
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

  return (
    <group>
      <primitive object={built.group} />
      {mode === "anatomy" && (
        <AnatomyCallout
          anchor={built.domeAnchor}
          label={`${caseMeta.location} aneurysm dome`}
          detail={`Ø ${caseMeta.maxDiameterMm.toFixed(1)} mm · AR ${caseMeta.aspectRatio.toFixed(1)}`}
        />
      )}
    </group>
  );
}
