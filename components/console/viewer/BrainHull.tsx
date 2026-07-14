"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useCaseScene } from "./CaseSceneProvider";

/**
 * Translucent brain hull — an anatomical context envelope around the vessels.
 * Rendered inside-out (BackSide, no depth write) so it never occludes the
 * vasculature. Aligned to the shared normalization transform from the scene
 * provider (same scale/center CaseModel uses), so it registers with the vessels.
 */
export default function BrainHull({ url }: { url: string }) {
  const scene = useCaseScene();
  const gltf = useGLTF(url);

  const obj = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#8a90a8"),
          transparent: true,
          opacity: 0.06,
          roughness: 0.9,
          metalness: 0,
          side: THREE.BackSide,
          depthWrite: false,
        });
      }
    });
    return clone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf.scene]);

  useEffect(() => {
    return () => {
      obj.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) (mesh.material as THREE.Material)?.dispose();
      });
    };
  }, [obj]);

  if (!scene) return null;
  const s = scene.scale;
  const c = scene.center;
  return (
    <group scale={s} position={[-c[0] * s, -c[1] * s, -c[2] * s]}>
      <primitive object={obj} />
    </group>
  );
}
