/**
 * Configurador 3D de cartelería — helpers de render (PBR, entorno, glow,
 * día/noche, pulso de hover). Port del prototipo signage/signage-render.jsx
 * (claude.ai/design), tipado y sin globals de window.
 */
import * as THREE from "three";

export function makeRealRenderer(
  container: HTMLElement,
  w: number,
  h: number,
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
}

/** Entorno de estudio sintético → PMREM para reflejos PBR (sin assets). */
export function makeStudioEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  const panel = (
    color: number,
    x: number,
    y: number,
    z: number,
    sw: number,
    sh: number,
  ) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(sw, sh),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panel(0xfdf9f0, 0, 8, 0, 14, 14); // luz cenital cálida
  panel(0xc3ccda, -8, 2, 4, 8, 10); // fill frío izquierda
  panel(0x8d9099, 8, 1, -3, 6, 8); // fill gris derecha
  panel(0x3c3f46, 0, -8, 0, 14, 14); // piso oscuro
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.06).texture;
  pmrem.dispose();
  return env;
}

export type SignMood = {
  bg: number;
  ground: number;
  wall: number;
  hemi: number;
  sun: number;
  sunColor: number;
  signLight: number;
  ledGlow: number;
  ledEmissive: number;
  faceEmissive: number;
  faceGlow: number;
};

export const SIGN_MOODS: Record<"dia" | "noche", SignMood> = {
  dia: {
    bg: 0xe7e5df,
    ground: 0xd4d1c9,
    wall: 0xdad7d0,
    hemi: 0.55,
    sun: 0.95,
    sunColor: 0xfff4e0,
    signLight: 0.0,
    ledGlow: 0.1,
    ledEmissive: 0.45,
    faceEmissive: 0.0,
    faceGlow: 0.0,
  },
  noche: {
    bg: 0x0c0f14,
    ground: 0x14171c,
    wall: 0x181b21,
    hemi: 0.16,
    sun: 0.1,
    sunColor: 0x93a7c8,
    signLight: 1.25,
    ledGlow: 0.55,
    ledEmissive: 2.2,
    faceEmissive: 1.05,
    faceGlow: 0.26,
  },
};

let glowTex: THREE.CanvasTexture | null = null;
function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,.55)");
  g.addColorStop(0.6, "rgba(255,255,255,.14)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function makeGlow(
  color: number,
  opacity: number,
  sx: number,
  sy?: number,
): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(sx, sy ?? sx, 1);
  s.userData.isGlow = true;
  return s;
}

type PulsableMaterial = THREE.Material & {
  color?: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
};

/** Restaura los materiales de un grupo a sus valores base (fin del hover). */
export function restoreGroupMaterials(group: THREE.Object3D): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const material = mesh.material as PulsableMaterial | undefined;
    if (!material || obj.userData.isGlow) return;
    if (obj.userData.baseColor !== undefined && material.color) {
      material.color.set(obj.userData.baseColor);
    }
    if (material.emissive !== undefined) {
      material.emissive.set(
        obj.userData.baseEmissive !== undefined
          ? obj.userData.baseEmissive
          : 0x000000,
      );
      if (obj.userData.baseEmissiveInt !== undefined) {
        material.emissiveIntensity = obj.userData.baseEmissiveInt;
      }
    }
  });
}

/** Pulso de resaltado sobre un grupo (hover BOM↔3D). */
export function pulseGroup(group: THREE.Object3D, pulse: number): void {
  const hl = new THREE.Color("#f59e0b");
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const material = mesh.material as PulsableMaterial | undefined;
    if (!material || obj.userData.isGlow) return;
    if (obj.userData.baseColor !== undefined && material.color) {
      const base = new THREE.Color(obj.userData.baseColor);
      base.lerp(hl, 0.4 + pulse * 0.3);
      material.color.copy(base);
    }
    if (material.emissive !== undefined) {
      material.emissive.copy(hl);
      material.emissiveIntensity = 0.35 + pulse * 0.55;
    }
  });
}
