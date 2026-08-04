"use client";

/**
 * Configurador 3D de cartelería — viewport three.js (backlight/frontlight).
 * Port de signage/signage-viewport.jsx del prototipo (claude.ai/design):
 * render PBR con sombras, LEDs emisivos con glow, día/noche, vista explotada,
 * capas y hover. La escena se construye desde `CarteleriaVista` + métricas
 * derivadas client-side; el precio NUNCA sale de acá (lo calcula el motor).
 */
import * as React from "react";
import * as THREE from "three";

import {
  SIGN_MOODS,
  makeGlow,
  makeRealRenderer,
  makeStudioEnv,
  pulseGroup,
  restoreGroupMaterials,
} from "./render-helpers";
import { grafoLogoTexture } from "./grafo-logo";
import { derivarMetricas, type CarteleriaVista, type MetricasCartel } from "./geometria";
import s from "./carteleria.module.css";

type Groups = Record<string, THREE.Group>;

/* ─────────── Constructor de la escena del cartel ─────────── */
function buildSign(
  parent: THREE.Group,
  vista: CarteleriaVista,
  metricas: MetricasCartel,
  mood: "dia" | "noche",
): Groups {
  const { width: W, height: H, depth: D } = vista;
  const isFront = vista.tipoCartel === "frontlight";
  const prof = vista.perfilLadoM;
  const M = SIGN_MOODS[mood];

  const groups: Groups = {};

  // Con esmalte el caño va negro semimate; sin pintura queda el acero crudo
  // (galvanizado claro) — así el toggle de pintura SE VE en el 3D.
  const steelColor = vista.pintura ? 0x2e3138 : 0x9aa0a8;
  const reinforceCol = vista.pintura ? 0x3c4048 : 0x8a9098;
  const galvColor = 0x878c93;
  const mountColor = 0xa9afb8;
  const psuColor = 0x1b1d22;
  const ledCore = 0xfff3d6;
  const ledEmit = 0xffc46b;
  const lonaColor = 0xf6f2e8;
  const lonaEmit = 0xffdca8;

  function beam(length: number, axis: "x" | "y" | "z", color: number) {
    const dims: [number, number, number] =
      axis === "x"
        ? [length, prof, prof]
        : axis === "y"
          ? [prof, length, prof]
          : [prof, prof, length];
    const g = new THREE.BoxGeometry(...dims);
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.55,
      roughness: 0.48,
    });
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.userData.baseColor = color;
    return m;
  }

  /* ── Marco ── */
  const frameGroup = new THREE.Group();
  groups.frame = frameGroup;
  parent.add(frameGroup);

  if (isFront) {
    [H / 2, -H / 2].forEach((y) => {
      const b = beam(W, "x", steelColor);
      b.position.set(0, y, 0);
      frameGroup.add(b);
    });
    [-W / 2, W / 2].forEach((x) => {
      const b = beam(H, "y", steelColor);
      b.position.set(x, 0, 0);
      frameGroup.add(b);
    });
  } else {
    (
      [
        [H / 2, D / 2],
        [H / 2, -D / 2],
        [-H / 2, D / 2],
        [-H / 2, -D / 2],
      ] as const
    ).forEach(([y, z]) => {
      const b = beam(W, "x", steelColor);
      b.position.set(0, y, z);
      frameGroup.add(b);
    });
    (
      [
        [-W / 2, D / 2],
        [W / 2, D / 2],
        [-W / 2, -D / 2],
        [W / 2, -D / 2],
      ] as const
    ).forEach(([x, z]) => {
      const b = beam(H, "y", steelColor);
      b.position.set(x, 0, z);
      frameGroup.add(b);
    });
    (
      [
        [-W / 2, H / 2],
        [W / 2, H / 2],
        [-W / 2, -H / 2],
        [W / 2, -H / 2],
      ] as const
    ).forEach(([x, y]) => {
      const b = beam(D, "z", steelColor);
      b.position.set(x, y, 0);
      frameGroup.add(b);
    });
  }

  /* ── Refuerzos verticales ── */
  if (metricas.refuerzosV > 0) {
    const g = new THREE.Group();
    groups["reinforce-v"] = g;
    parent.add(g);
    const cols = metricas.refuerzosV;
    for (let i = 1; i <= cols; i++) {
      const x = -W / 2 + (W * i) / (cols + 1);
      if (isFront) {
        const b2 = beam(H, "y", reinforceCol);
        b2.position.set(x, 0, 0);
        g.add(b2);
      } else {
        // sólo al dorso — el frente va libre para no marcar la lona
        const b2 = beam(H, "y", reinforceCol);
        b2.position.set(x, 0, -D / 2);
        g.add(b2);
        const c1 = beam(D, "z", reinforceCol);
        c1.position.set(x, H / 2, 0);
        g.add(c1);
        const c2 = beam(D, "z", reinforceCol);
        c2.position.set(x, -H / 2, 0);
        g.add(c2);
      }
    }
  }

  /* ── Refuerzos horizontales ── */
  if (metricas.refuerzosH > 0) {
    const g = new THREE.Group();
    groups["reinforce-h"] = g;
    parent.add(g);
    const rows = metricas.refuerzosH;
    for (let i = 1; i <= rows; i++) {
      const y = -H / 2 + (H * i) / (rows + 1);
      if (isFront) {
        const b1 = beam(W, "x", reinforceCol);
        b1.position.set(0, y, 0);
        g.add(b1);
      } else {
        const b1 = beam(W, "x", reinforceCol);
        b1.position.set(0, y, D / 2);
        g.add(b1);
        const b2 = beam(W, "x", reinforceCol);
        b2.position.set(0, y, -D / 2);
        g.add(b2);
      }
    }
  }

  /* ── Cara frontal (lona) ── */
  const frontGroup = new THREE.Group();
  groups.front = frontGroup;
  parent.add(frontGroup);

  const frontGeom = new THREE.PlaneGeometry(W, H);
  const frontMat = new THREE.MeshPhysicalMaterial({
    color: lonaColor,
    roughness: isFront ? 0.62 : 0.55,
    metalness: 0,
    transparent: true,
    opacity: isFront ? 1 : 0.94,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(lonaEmit),
    emissiveIntensity: isFront ? 0 : M.faceEmissive,
  });
  let frontMesh: THREE.Mesh;
  if (isFront) {
    // Lona tensada que envuelve el bastidor: frente + 4 faldones, contra abierta.
    const BW = W + prof + 0.01;
    const BH = H + prof + 0.01;
    const BD = D + 0.006;
    frontMesh = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), frontMat);
    frontMesh.position.set(0, 0, BD / 2);
    const skirtMat = frontMat.clone();
    const top = new THREE.Mesh(new THREE.PlaneGeometry(BW, BD), skirtMat);
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, BH / 2, 0);
    const bot = new THREE.Mesh(new THREE.PlaneGeometry(BW, BD), skirtMat);
    bot.rotation.x = Math.PI / 2;
    bot.position.set(0, -BH / 2, 0);
    const lft = new THREE.Mesh(new THREE.PlaneGeometry(BD, BH), skirtMat);
    lft.rotation.y = -Math.PI / 2;
    lft.position.set(-BW / 2, 0, 0);
    const rgt = new THREE.Mesh(new THREE.PlaneGeometry(BD, BH), skirtMat);
    rgt.rotation.y = Math.PI / 2;
    rgt.position.set(BW / 2, 0, 0);
    [top, bot, lft, rgt].forEach((m) => {
      m.userData.baseColor = lonaColor;
      frontGroup.add(m);
    });
  } else {
    frontMesh = new THREE.Mesh(frontGeom, frontMat);
    frontMesh.position.set(0, 0, D / 2 + 0.002);
  }
  frontMesh.userData.baseColor = lonaColor;
  frontMesh.userData.baseEmissive = lonaEmit;
  frontMesh.userData.baseEmissiveInt = isFront ? 0 : M.faceEmissive;
  frontGroup.add(frontMesh);

  // Logo impreso, centrado en la lona
  const logoTex = grafoLogoTexture("#17171d");
  const logoAsp = (logoTex.userData?.aspect as number) || 2.6;
  const mkLogo = () => {
    let lw = W * 0.6;
    let lh = lw / logoAsp;
    if (lh > H * 0.42) {
      lh = H * 0.42;
      lw = lh * logoAsp;
    }
    const mat = new THREE.MeshStandardMaterial({
      map: logoTex,
      transparent: true,
      side: THREE.DoubleSide,
      roughness: 0.55,
      metalness: 0,
      depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), mat);
    m.userData.baseColor = 0xffffff;
    return m;
  };
  const logoFront = mkLogo();
  logoFront.position.set(0, 0, D / 2 + 0.004);
  frontGroup.add(logoFront);

  if (!isFront && M.faceGlow > 0) {
    const halo = makeGlow(0xffd9a0, M.faceGlow, W * 1.45, H * 1.5);
    halo.position.set(0, 0, D / 2 + 0.06);
    frontGroup.add(halo);
  }

  /* ── Panel posterior (sólo si lleva chapa trasera) ── */
  const backGroup = new THREE.Group();
  groups.back = backGroup;
  parent.add(backGroup);

  if (!isFront && vista.fondo) {
    const backMat = new THREE.MeshStandardMaterial({
      color: galvColor,
      metalness: 0.82,
      roughness: 0.46,
      side: THREE.DoubleSide,
    });
    const backMesh = new THREE.Mesh(frontGeom.clone(), backMat);
    backMesh.userData.baseColor = galvColor;
    backMesh.position.set(0, 0, -D / 2 - 0.002);
    backMesh.rotation.y = Math.PI;
    backMesh.castShadow = true;
    backGroup.add(backMesh);
  }

  /* ── Grilla LED ── */
  const ledGroup = new THREE.Group();
  groups.led = ledGroup;
  parent.add(ledGroup);

  if (!isFront && metricas.ledCols > 0) {
    const ledMat = new THREE.MeshStandardMaterial({
      color: ledCore,
      roughness: 0.4,
      emissive: new THREE.Color(ledEmit),
      emissiveIntensity: M.ledEmissive,
    });
    const cols = metricas.ledCols;
    const rows = metricas.ledRows;
    const ledGeom = new THREE.BoxGeometry(0.05, 0.04, 0.012);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = -W / 2 + (c + 0.5) * (W / cols);
        const y = -H / 2 + (r + 0.5) * (H / rows);
        const led = new THREE.Mesh(ledGeom, ledMat);
        led.userData.baseColor = ledCore;
        led.userData.baseEmissive = ledEmit;
        led.userData.baseEmissiveInt = M.ledEmissive;
        led.position.set(x, y, -D / 2 + 0.04);
        ledGroup.add(led);
        if (M.ledGlow > 0.01) {
          const glow = makeGlow(ledEmit, M.ledGlow, 0.24);
          glow.position.set(x, y, -D / 2 + 0.05);
          ledGroup.add(glow);
        }
      }
    }
  }

  /* ── Fuente ── */
  const psuGroup = new THREE.Group();
  groups.psu = psuGroup;
  parent.add(psuGroup);
  if (!isFront) {
    const psuGeom = new THREE.BoxGeometry(0.22, 0.06, 0.1);
    const psuMat = new THREE.MeshStandardMaterial({
      color: psuColor,
      metalness: 0.4,
      roughness: 0.5,
    });
    const psu = new THREE.Mesh(psuGeom, psuMat);
    psu.castShadow = true;
    psu.userData.baseColor = psuColor;
    psu.position.set(W / 2 - 0.18, H / 2 + 0.05, 0);
    psuGroup.add(psu);
  }

  /* ── Anclajes ── */
  const mountGroup = new THREE.Group();
  groups.mount = mountGroup;
  parent.add(mountGroup);

  const mountGeom = new THREE.BoxGeometry(0.08, 0.08, 0.04);
  const mountMat = new THREE.MeshStandardMaterial({
    color: mountColor,
    metalness: 0.88,
    roughness: 0.36,
  });
  const mountCount = Math.max(2, Math.ceil(W / 0.8));
  for (let i = 0; i < mountCount; i++) {
    const x = -W / 2 + (W * (i + 1)) / (mountCount + 1);
    [-H / 4, H / 4].forEach((y) => {
      const m = new THREE.Mesh(mountGeom, mountMat);
      m.castShadow = true;
      m.userData.baseColor = mountColor;
      m.position.set(x, y, -D / 2 - 0.04);
      mountGroup.add(m);
    });
  }

  /* ── Cenefa (chapa plegada lateral) ── */
  if (vista.cenefa && !isFront) {
    const cg = new THREE.Group();
    groups.cenefa = cg;
    parent.add(cg);

    const t = 0.008;
    const foldM = vista.solapaCenefaCm / 100;
    const chColor = 0x9aa0a8;
    const chMat = new THREE.MeshStandardMaterial({
      color: chColor,
      metalness: 0.85,
      roughness: 0.4,
    });

    const outX = W / 2 + prof / 2;
    const outY = H / 2 + prof / 2;
    const Dband = D + prof;
    const lap = prof / 2 + foldM;

    const sides: Record<string, THREE.Group> = {
      top: new THREE.Group(),
      bottom: new THREE.Group(),
      left: new THREE.Group(),
      right: new THREE.Group(),
    };
    sides.top.userData.explodeDir = new THREE.Vector3(0, 1, 0);
    sides.bottom.userData.explodeDir = new THREE.Vector3(0, -1, 0);
    sides.left.userData.explodeDir = new THREE.Vector3(-1, 0, 0);
    sides.right.userData.explodeDir = new THREE.Vector3(1, 0, 0);
    Object.values(sides).forEach((g) => cg.add(g));

    function panel(
      side: string,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
    ) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), chMat);
      mesh.castShadow = true;
      mesh.userData.baseColor = chColor;
      mesh.position.set(x, y, z);
      sides[side].add(mesh);
    }

    // Bandas laterales por fuera de los caños
    panel("top", W + prof + 2 * t, t, Dband, 0, outY + t / 2, 0);
    panel("bottom", W + prof + 2 * t, t, Dband, 0, -outY - t / 2, 0);
    panel("left", t, H + prof, Dband, -outX - t / 2, 0, 0);
    panel("right", t, H + prof, Dband, outX + t / 2, 0, 0);

    // Solapas de plegado sobre el frente y la contra
    const zf = D / 2 + prof / 2 + t / 2;
    const zb = -D / 2 - prof / 2 - t / 2;
    for (const z of [zf, zb]) {
      panel("top", W + prof + 2 * t, lap, t, 0, outY + t / 2 - lap / 2, z);
      panel("bottom", W + prof + 2 * t, lap, t, 0, -outY - t / 2 + lap / 2, z);
      panel("left", lap, H + prof, t, -outX - t / 2 + lap / 2, 0, z);
      panel("right", lap, H + prof, t, outX + t / 2 - lap / 2, 0, z);
    }
  }

  return groups;
}

/* ─────────── Componente ─────────── */

const EXPLODE_Z: Record<string, number> = {
  front: 0.5,
  led: 0.26,
  psu: 0.26,
  frame: 0,
  "reinforce-v": 0,
  "reinforce-h": 0,
  back: -0.42,
  mount: -0.62,
};

// Swatches del prototipo (panel de capas claro).
const CAPAS: Array<{ k: string; nm: string; sw: string }> = [
  { k: "frame", nm: "Estructura", sw: "#2c2c33" },
  { k: "reinforce-v", nm: "Refuerzos V", sw: "#4a4a52" },
  { k: "reinforce-h", nm: "Refuerzos H", sw: "#4a4a52" },
  { k: "front", nm: "Lona frontal", sw: "#a8a6a0" },
  { k: "back", nm: "Panel posterior", sw: "#3a3a40" },
  { k: "led", nm: "LEDs", sw: "#f59e0b" },
  { k: "psu", nm: "Fuente", sw: "#14141a" },
  { k: "cenefa", nm: "Cenefa lateral", sw: "#9aa0a8" },
  { k: "mount", nm: "Anclajes", sw: "#6e6e76" },
];

type SceneState = {
  ready: boolean;
  renderer?: THREE.WebGLRenderer;
  scene?: THREE.Scene;
  camera?: THREE.PerspectiveCamera;
  signGroup?: THREE.Group;
  setOrbit?: (t: number, p: number, d: number) => void;
  hemi?: THREE.HemisphereLight;
  sun?: THREE.DirectionalLight;
  signLight?: THREE.PointLight;
  ground?: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>;
  groups: Groups;
  hovered: string | null;
  exploded: boolean;
};

export function CarteleriaViewport({
  vista,
  hoverComponent,
}: {
  vista: CarteleriaVista;
  /** Grupo a resaltar desde afuera (hover del desglose). */
  hoverComponent?: string | null;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const stateRef = React.useRef<SceneState>({
    ready: false,
    groups: {},
    hovered: null,
    exploded: false,
  });
  const [mood, setMood] = React.useState<"dia" | "noche">("noche");
  const [viewMode, setViewMode] = React.useState("iso");
  const [exploded, setExploded] = React.useState(false);
  const [layers, setLayers] = React.useState<Record<string, boolean>>({});

  const metricas = React.useMemo(() => derivarMetricas(vista), [vista]);

  // Montaje único de la escena
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.offsetWidth || 800;
    const h = container.offsetHeight || 600;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SIGN_MOODS.noche.bg);

    const camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 100);
    const renderer = makeRealRenderer(container, w, h);
    scene.environment = makeStudioEnv(renderer);

    const hemi = new THREE.HemisphereLight(0xdfe8f5, 0x3a3a36, 0.16);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff4e0, 0.1);
    sun.position.set(3.5, 5, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -4;
    sun.shadow.camera.right = 4;
    sun.shadow.camera.top = 4;
    sun.shadow.camera.bottom = -4;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 15;
    sun.shadow.bias = -0.0004;
    scene.add(sun);

    const signLight = new THREE.PointLight(0xffd9a0, 1.25, 7, 2);
    signLight.position.set(0, 0, 0.4);
    scene.add(signLight);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(7, 48),
      new THREE.MeshStandardMaterial({
        color: SIGN_MOODS.noche.ground,
        roughness: 0.95,
        metalness: 0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.4;
    ground.receiveShadow = true;
    scene.add(ground);

    const signGroup = new THREE.Group();
    scene.add(signGroup);

    let theta = Math.PI * 0.55;
    let phi = Math.PI * 0.4;
    let dist = 5.2;
    const target = new THREE.Vector3(0, 0, 0);
    function update() {
      camera.position.x = target.x + dist * Math.sin(phi) * Math.cos(theta);
      camera.position.y = target.y + dist * Math.cos(phi);
      camera.position.z = target.z + dist * Math.sin(phi) * Math.sin(theta);
      camera.lookAt(target);
    }
    update();

    let dragging = false;
    let mx = 0;
    let my = 0;
    const dom = renderer.domElement;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      mx = e.clientX;
      my = e.clientY;
      dom.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      theta -= (e.clientX - mx) * 0.008;
      phi -= (e.clientY - my) * 0.008;
      phi = Math.max(0.06, Math.min(Math.PI - 0.06, phi));
      mx = e.clientX;
      my = e.clientY;
      update();
    };
    const endDrag = (e: PointerEvent) => {
      dragging = false;
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {}
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      dist *= 1 + e.deltaY * 0.0015;
      dist = Math.max(1.6, Math.min(14, dist));
      update();
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", endDrag);
    dom.addEventListener("pointerleave", endDrag);
    dom.addEventListener("wheel", onWheel, { passive: false });

    function setOrbit(t: number, p: number, d: number) {
      const start = { theta, phi, dist };
      const end = { theta: t, phi: p, dist: d };
      const t0 = performance.now();
      const dur = 480;
      function step() {
        const u = Math.min(1, (performance.now() - t0) / dur);
        const e = 1 - Math.pow(1 - u, 3);
        theta = start.theta + (end.theta - start.theta) * e;
        phi = start.phi + (end.phi - start.phi) * e;
        dist = start.dist + (end.dist - start.dist) * e;
        update();
        if (u < 1) requestAnimationFrame(step);
      }
      step();
    }

    let tick = 0;
    let raf = 0;
    let explodeT = 0;
    function animate() {
      tick++;
      const st = stateRef.current;
      const groups = st.groups;

      const targetT = st.exploded ? 1 : 0;
      explodeT += (targetT - explodeT) * 0.1;
      Object.entries(groups).forEach(([k, g]) => {
        if (k === "cenefa") {
          g.children.forEach((side) => {
            const dir = side.userData.explodeDir as THREE.Vector3 | undefined;
            if (dir) side.position.copy(dir).multiplyScalar(0.24 * explodeT);
          });
        } else {
          g.position.z = (EXPLODE_Z[k] || 0) * explodeT;
        }
      });

      const hovered = st.hovered;
      if (hovered && groups[hovered]) {
        const pulse = 0.55 + 0.45 * Math.sin(tick * 0.14);
        pulseGroup(groups[hovered], pulse);
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);

    const onResize = () => {
      const w2 = container.offsetWidth;
      const h2 = container.offsetHeight;
      if (w2 === 0 || h2 === 0) return;
      renderer.setSize(w2, h2);
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    stateRef.current = {
      ready: true,
      renderer,
      scene,
      camera,
      signGroup,
      setOrbit,
      hemi,
      sun,
      signLight,
      ground,
      groups: {},
      hovered: null,
      exploded: false,
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (dom.parentNode === container) container.removeChild(dom);
      renderer.dispose();
      stateRef.current = { ready: false, groups: {}, hovered: null, exploded: false };
    };
  }, []);

  // Día/noche
  React.useEffect(() => {
    const st = stateRef.current;
    if (!st.ready) return;
    const M = SIGN_MOODS[mood];
    (st.scene!.background as THREE.Color).setHex(M.bg);
    st.hemi!.intensity = M.hemi;
    st.sun!.intensity = M.sun;
    st.sun!.color.setHex(M.sunColor);
    st.signLight!.intensity = M.signLight;
    st.ground!.material.color.setHex(M.ground);
  }, [mood]);

  // Reconstrucción del cartel
  React.useEffect(() => {
    const st = stateRef.current;
    if (!st.ready) return;
    const sg = st.signGroup!;
    while (sg.children.length) {
      const c = sg.children.pop()!;
      c.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
          else mesh.material.dispose();
        }
      });
      sg.remove(c);
    }
    st.groups = buildSign(sg, vista, metricas, mood);
    Object.entries(st.groups).forEach(([k, g]) => {
      g.visible = layers[k] !== false;
    });
  }, [vista, metricas, mood, layers]);

  // Hover desde el desglose
  React.useEffect(() => {
    const st = stateRef.current;
    if (!st.ready) return;
    st.hovered = hoverComponent ?? null;
    Object.entries(st.groups).forEach(([k, g]) => {
      if (k !== hoverComponent) restoreGroupMaterials(g);
    });
    if (!hoverComponent) Object.values(st.groups).forEach(restoreGroupMaterials);
  }, [hoverComponent]);

  // Vista explotada
  React.useEffect(() => {
    stateRef.current.exploded = exploded;
  }, [exploded]);

  // Presets de cámara
  React.useEffect(() => {
    const st = stateRef.current;
    if (!st.ready || !st.setOrbit) return;
    const presets: Record<string, { theta: number; phi: number; dist: number }> = {
      iso: { theta: Math.PI * 0.55, phi: Math.PI * 0.4, dist: 5.2 },
      frente: { theta: Math.PI * 0.5, phi: Math.PI * 0.5, dist: 4.0 },
      lateral: { theta: 0, phi: Math.PI * 0.5, dist: 3.2 },
      planta: { theta: Math.PI * 0.5, phi: 0.08, dist: 3.6 },
    };
    const v = presets[viewMode];
    if (v) st.setOrbit(v.theta, v.phi, v.dist);
  }, [viewMode]);

  const isFront = vista.tipoCartel === "frontlight";
  const capaExiste: Record<string, boolean> = {
    frame: true,
    "reinforce-v": metricas.refuerzosV > 0,
    "reinforce-h": metricas.refuerzosH > 0,
    front: true,
    back: !isFront && vista.fondo,
    led: !isFront,
    psu: !isFront,
    cenefa: vista.cenefa && !isFront,
    mount: true,
  };

  return (
    <div className={s.viewport}>
      <div className={s.canvasHost} ref={containerRef} />

      <div className={`${s.overlay} ${s.vpTitle}`}>
        <div className={s.vpName}>
          {isFront ? "Frontlight" : "Backlight"}
        </div>
        <div className={s.vpDims}>
          {(vista.width * 100).toFixed(0)} × {(vista.height * 100).toFixed(0)}
          {isFront ? "" : ` × ${(vista.depth * 100).toFixed(0)}`} cm
        </div>
      </div>

      <div className={`${s.overlay} ${s.vpViews}`}>
        {["iso", "frente", "lateral", "planta"].map((v) => (
          <button
            key={v}
            type="button"
            className={v === viewMode ? s.on : ""}
            onClick={() => setViewMode(v)}
          >
            {v}
          </button>
        ))}
      </div>

      <div className={`${s.overlay} ${s.vpViews} ${s.vpMood}`}>
        {(
          [
            ["dia", "día"],
            ["noche", "noche"],
          ] as const
        ).map(([k, nm]) => (
          <button
            key={k}
            type="button"
            className={k === mood ? s.on : ""}
            onClick={() => setMood(k)}
          >
            {nm}
          </button>
        ))}
      </div>

      <div className={`${s.overlay} ${s.vpExplode}`}>
        <button
          type="button"
          className={`${s.explodeBtn} ${exploded ? s.on : ""}`}
          onClick={() => setExploded(!exploded)}
          title="Separar las capas para inspeccionar la construcción"
        >
          {exploded ? "Compactar" : "Vista explotada"}
        </button>
      </div>

      <div className={`${s.overlay} ${s.vpLayers}`}>
        <div className={s.lgnd}>Capas</div>
        {CAPAS.map((l) => {
          const exists = capaExiste[l.k] !== false;
          const on = layers[l.k] !== false;
          return (
            <button
              key={l.k}
              type="button"
              className={`${s.layer} ${!on ? s.layerOff : ""}`}
              style={{ opacity: exists ? 1 : 0.35 }}
              onClick={() => exists && setLayers((prev) => ({ ...prev, [l.k]: !on }))}
            >
              <span
                className={s.swatch}
                style={{
                  background: on ? l.sw : "transparent",
                  borderColor: l.sw,
                }}
              />
              <span>{l.nm}</span>
            </button>
          );
        })}
      </div>

      <div className={`${s.overlay} ${s.vpScale}`}>
        <div className={s.lgnd}>
          {metricas.mlTotal.toFixed(1)} ml de perfil · {metricas.puntosSoldadura}{" "}
          soldaduras
          {!isFront && metricas.ledCount > 0
            ? ` · ${metricas.ledCount} LEDs (${metricas.ledCols}×${metricas.ledRows})`
            : ""}
          {metricas.cenefaM2 > 0 ? ` · cenefa ${metricas.cenefaM2.toFixed(2)} m²` : ""}
        </div>
      </div>
    </div>
  );
}
