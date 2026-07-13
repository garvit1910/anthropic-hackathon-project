"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import {
  noiseV3,
  flVert,
  flFrag,
  heroVertexShader,
  heroFragmentShader,
} from "@/lib/shaders";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface BrainHeroProps {
  /** Flip true (once) to play the resolve-into-vasculature transition. */
  startTransition?: boolean;
  /** Fired when the transition completes (route from here). */
  onTransitionEnd?: () => void;
  /** vessel_tree.glb to cross-fade into. Falls back to fade-to-black if absent. */
  vesselUrl?: string;
  onReady?: () => void;
  className?: string;
}

export default function BrainHero({
  startTransition = false,
  onTransitionEnd,
  vesselUrl,
  onReady,
  className,
}: BrainHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Bridge the React prop into the imperative animation loop.
  const transitionRef = useRef({ active: false, done: false });
  useEffect(() => {
    if (startTransition) transitionRef.current.active = true;
  }, [startTransition]);
  const onTransitionEndRef = useRef(onTransitionEnd);
  onTransitionEndRef.current = onTransitionEnd;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    const perlin = new ImprovedNoise();
    const v3 = new THREE.Vector3();

    // --- smoothstep + deform (verbatim from the pen) ---
    function smoothstep(min: number, max: number, value: number) {
      const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
      return x * x * (3 - 2 * x);
    }
    function deform(p: THREE.Vector3, useLength?: boolean) {
      const mainR = 5;
      v3.copy(p).normalize();
      const len = p.length();
      let ns = perlin.noise(v3.x * 3, v3.y * 3, v3.z * 3);
      ns = Math.pow(Math.abs(ns), 0.5) * 0.25;
      const r = smoothstep(0.125, 0, Math.abs(v3.x)) - ns;
      p.setLength(mainR - Math.pow(r, 2) * 1);
      p.y *= 1 - 0.5 * smoothstep(0, -mainR, p.y);
      p.y *= 0.75;
      p.x *= 0.75;
      p.y *= 1 - 0.125 * smoothstep(mainR * 0.25, -mainR, p.z);
      p.x *= 1 - 0.125 * smoothstep(mainR * 0.25, -mainR, p.z);
      if (useLength) p.multiplyScalar(len);
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 5000);
    camera.position.set(5, 2, 5).setLength(12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 1;
    controls.maxDistance = 15;
    controls.autoRotate = !reducedMotion;
    controls.autoRotateSpeed = 0.5;

    const globalUniforms = {
      time: { value: 0 },
      bloom: { value: 0 },
      fade: { value: 0 }, // 0 = brain, 1 = resolved into vessels
    };

    // --- CURVE (magenta Line2) ---
    const curvePts = new Array(200)
      .fill(0)
      .map(() => new THREE.Vector3().randomDirection());
    let curve: THREE.CatmullRomCurve3 = new THREE.CatmullRomCurve3(
      curvePts,
      true
    );
    let pts = curve.getSpacedPoints(200);
    pts.shift();
    curve = new THREE.CatmullRomCurve3(pts, true);
    pts = curve.getSpacedPoints(10000);
    pts.forEach((p) => p.setLength(4));
    pts.forEach((p) => deform(p));

    const fPts: number[] = [];
    pts.forEach((p) => fPts.push(p.x, p.y, p.z));

    const g = new LineGeometry();
    g.setPositions(fPts);

    // Inject the `fade` uniform + multiply into the verbatim flFrag.
    const flFragFaded = flFrag
      .replace("uniform float bloom;", "uniform float bloom;\n  uniform float fade;")
      .replace(
        "gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(vec3(1), col, bloom), pn2);",
        "gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(vec3(1), col, bloom), pn2);\n      gl_FragColor.rgb *= (1.0 - fade);\n      gl_FragColor.a *= (1.0 - fade);"
      );

    const m = new (LineMaterial as any)({
      color: 0x6f8196,
      worldUnits: true,
      linewidth: 0.0375,
      alphaToCoverage: true,
      onBeforeCompile: (shader: any) => {
        shader.uniforms.time = globalUniforms.time;
        shader.uniforms.bloom = globalUniforms.bloom;
        shader.uniforms.fade = globalUniforms.fade;
        shader.vertexShader = flVert;
        shader.fragmentShader = flFragFaded;
      },
    });
    m.resolution.set(width, height);
    const l = new Line2(g, m);
    l.computeLineDistances();
    scene.add(l);

    // --- SPHERE (violet wireframe, snoise cyan) ---
    const sg = new THREE.IcosahedronGeometry(1, 70);
    for (let i = 0; i < sg.attributes.position.count; i++) {
      v3.fromBufferAttribute(sg.attributes.position as THREE.BufferAttribute, i);
      deform(v3);
      sg.attributes.position.setXYZ(i, v3.x, v3.y, v3.z);
    }
    const sm = new (THREE.MeshBasicMaterial as any)({
      color: 0x4db6c9,
      wireframe: true,
      transparent: true,
      onBeforeCompile: (shader: any) => {
        shader.uniforms.bloom = globalUniforms.bloom;
        shader.uniforms.time = globalUniforms.time;
        shader.uniforms.fade = globalUniforms.fade;
        shader.vertexShader = `
          varying vec3 vN;
          ${shader.vertexShader}
        `.replace(
          `#include <begin_vertex>`,
          `#include <begin_vertex>
            vN = normal;
          `
        );
        shader.fragmentShader = `
          uniform float bloom;
          uniform float time;
          uniform float fade;
          varying vec3 vN;
          ${noiseV3}
          ${shader.fragmentShader}
        `.replace(
          `#include <dithering_fragment>`,
          `#include <dithering_fragment>
            float ns = snoise(vec4(vN * 1.5, time * 0.5));
            ns = abs(ns);

            vec3 col = mix(diffuse, vec3(0, 1, 1) * 0.5, ns);

            gl_FragColor.rgb = mix(col, vec3(0), bloom);
            gl_FragColor.a = ns;
            gl_FragColor.rgb = mix(gl_FragColor.rgb, col, pow(ns, 16.));
            gl_FragColor.rgb *= (1.0 - fade);
            gl_FragColor.a *= (1.0 - fade);
          `
        );
      },
    });
    const sphere = new THREE.Mesh(sg, sm);
    scene.add(sphere);

    // --- LINKS (dashed yellow synapse arcs) ---
    const LINK_COUNT = 50;
    const linkPts: THREE.Vector3[] = [];
    for (let i = 0; i < LINK_COUNT; i++) {
      const pS = new THREE.Vector3().randomDirection();
      const pE = new THREE.Vector3().randomDirection();
      const division = 100;
      for (let j = 0; j < division; j++) {
        const v1 = new THREE.Vector3().lerpVectors(pS, pE, j / division);
        const v2 = new THREE.Vector3().lerpVectors(pS, pE, (j + 1) / division);
        deform(v1, true);
        deform(v2, true);
        linkPts.push(v1, v2);
      }
    }
    const linkG = new THREE.BufferGeometry().setFromPoints(linkPts);
    const linkM = new (THREE.LineDashedMaterial as any)({
      color: 0xcf9f4a,
      onBeforeCompile: (shader: any) => {
        shader.uniforms.time = globalUniforms.time;
        shader.uniforms.bloom = globalUniforms.bloom;
        shader.uniforms.fade = globalUniforms.fade;
        shader.fragmentShader = `
          uniform float bloom;
          uniform float time;
          uniform float fade;
          ${shader.fragmentShader}
        `
          .replace(
            `if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}`,
            ``
          )
          .replace(
            `#include <premultiplied_alpha_fragment>`,
            `#include <premultiplied_alpha_fragment>
              vec3 col = diffuse;
              gl_FragColor.rgb = mix(col * 0.5, vec3(0), bloom);

              float sig = sin((vLineDistance * 2. + time * 5.) * 0.5) * 0.5 + 0.5;
              sig = pow(sig, 16.);
              gl_FragColor.rgb = mix(gl_FragColor.rgb, col * 0.75, sig);
              gl_FragColor.rgb *= (1.0 - fade);
            `
          );
      },
    });
    const link = new THREE.LineSegments(linkG, linkM);
    link.computeLineDistances();
    scene.add(link);

    // --- BACKGROUND (black behind the brain, per spec) ---
    const bg = new THREE.SphereGeometry(1000, 64, 32);
    const bm = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        bloom: globalUniforms.bloom,
        time: globalUniforms.time,
        fade: globalUniforms.fade,
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      `,
      fragmentShader: `
        uniform float bloom;
        uniform float time;
        uniform float fade;
        varying vec3 vNormal;
        ${noiseV3}
        void main() {
          // Base color forced to black (was a violet nebula in the pen).
          vec3 col = vec3(0.0);
          float ns = snoise(vec4(vNormal, time * 0.1));
          col = mix(col * 5., col, pow(abs(ns), 0.125));
          col = mix(col, vec3(0), bloom);
          col *= (1.0 - fade);
          gl_FragColor = vec4( col, 1.0 );
        }
      `,
    });
    const bo = new THREE.Mesh(bg, bm);
    scene.add(bo);

    // --- vessel_tree.glb cross-fade target (loaded lazily, hidden until transition) ---
    let vesselGroup: THREE.Group | null = null;
    const vesselMaterials: THREE.MeshBasicMaterial[] = [];
    if (vesselUrl) {
      new GLTFLoader().load(
        vesselUrl,
        (gltf) => {
          const grp = gltf.scene;
          grp.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.isMesh) {
              const mat = new THREE.MeshBasicMaterial({
                color: 0x9aa4bd,
                transparent: true,
                opacity: 0,
                depthWrite: false,
              });
              mesh.material = mat;
              vesselMaterials.push(mat);
            }
          });
          // Center + scale to roughly match the brain radius.
          const box = new THREE.Box3().setFromObject(grp);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          grp.position.sub(center);
          grp.scale.setScalar(7 / maxDim);
          grp.visible = false;
          scene.add(grp);
          vesselGroup = grp;
        },
        undefined,
        () => {
          /* GLB missing → transition gracefully falls back to fade-to-black */
        }
      );
    }

    // --- BLOOM (two-composer selective bloom, verbatim) ---
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.5,
      0.4,
      0.85
    );
    bloomPass.threshold = 0;
    bloomPass.strength = 2.8;
    bloomPass.radius = 0;

    const bloomComposer = new EffectComposer(renderer);
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass(renderScene);
    bloomComposer.addPass(bloomPass);

    const finalPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: bloomComposer.renderTarget2.texture },
        },
        vertexShader: heroVertexShader,
        fragmentShader: heroFragmentShader,
        defines: {},
      }),
      "baseTexture"
    );
    finalPass.needsSwap = true;

    const finalComposer = new EffectComposer(renderer);
    finalComposer.addPass(renderScene);
    finalComposer.addPass(finalPass);

    // --- resize ---
    function onResize() {
      width = container!.clientWidth || window.innerWidth;
      height = container!.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      m.resolution.set(width, height);
      bloomPass.resolution.set(width, height);
      bloomComposer.setSize(width, height);
      finalComposer.setSize(width, height);
    }
    window.addEventListener("resize", onResize);

    // --- animation loop ---
    const clock = new THREE.Clock();
    let transitionStart = -1;
    const TRANSITION_SEC = 1.25;

    renderer.setAnimationLoop(() => {
      const t = clock.getElapsedTime();
      controls.update();

      if (!reducedMotion) globalUniforms.time.value = t;

      // resolve-into-vasculature transition
      const tr = transitionRef.current;
      if (tr.active && !tr.done) {
        if (transitionStart < 0) transitionStart = t;
        const p = Math.min(1, (t - transitionStart) / TRANSITION_SEC);
        const eased = p * p * (3 - 2 * p);
        globalUniforms.fade.value = eased;
        controls.autoRotate = false;
        camera.position.setLength(THREE.MathUtils.lerp(12, 8.5, eased));
        if (vesselGroup) {
          vesselGroup.visible = eased > 0.001;
          for (const mat of vesselMaterials) mat.opacity = eased;
        }
        if (p >= 1 && !tr.done) {
          tr.done = true;
          onTransitionEndRef.current?.();
        }
      }

      // Selective-bloom composite: render bloom pass with bloom=1, then final.
      globalUniforms.bloom.value = 1;
      bloomComposer.render();
      globalUniforms.bloom.value = 0;
      finalComposer.render();
    });

    // First frame is up — reveal the title, hide the loader.
    const raf = requestAnimationFrame(() => {
      setReady(true);
      onReadyRef.current?.();
    });

    // --- cleanup ---
    return () => {
      cancelAnimationFrame(raf);
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      g.dispose();
      m.dispose();
      sg.dispose();
      sm.dispose();
      linkG.dispose();
      linkM.dispose();
      bg.dispose();
      bm.dispose();
      (finalPass.material as THREE.Material).dispose();
      if (vesselGroup) {
        vesselGroup.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose();
            const mat = mesh.material as THREE.Material | THREE.Material[];
            if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
            else mat?.dispose();
          }
        });
      }
      (bloomComposer as any).dispose?.();
      (finalComposer as any).dispose?.();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // vesselUrl intentionally stable for a mount; other props bridged via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vesselUrl]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 h-full w-full bg-black ${className ?? ""}`}
      aria-hidden
    >
      {/* Loading state (was #info). Recolored — original was black-on-black. */}
      <div
        className={`pointer-events-none absolute left-0 right-0 top-1/2 z-10 text-center display text-[2vh] tracking-widest text-white/80 transition-opacity duration-700 ${
          ready ? "opacity-0" : "opacity-90"
        }`}
      >
        initializing vasculature...
      </div>
    </div>
  );
}
