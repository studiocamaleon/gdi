"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Presentation geometry follows the backlight assembly used by Grafo's cartelería viewport.
 * This scene is illustrative and never provides bill-of-materials or price calculations. */
export default function SignScene({
  progress,
  illuminated,
}: {
  progress: number;
  illuminated: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const target = useRef({ progress, illuminated });
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    target.current = { progress, illuminated };
  }, [progress, illuminated]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      requestAnimationFrame(() => setUnavailable(true));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
    camera.position.set(5.2, 2.7, 6.8);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.15, 0.2);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minPolarAngle = Math.PI * 0.22;
    controls.maxPolarAngle = Math.PI * 0.57;
    controls.minAzimuthAngle = -0.85;
    controls.maxAzimuthAngle = 1.3;
    controls.rotateSpeed = 0.45;
    controls.update();
    // Keep vertical page scrolling available on touch screens.
    renderer.domElement.style.touchAction = "pan-y";
    controls.enabled = window.matchMedia("(pointer: fine)").matches;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const environmentScene = new RoomEnvironment();
    const environment = pmrem.fromScene(environmentScene, 0.04);
    scene.environment = environment.texture;
    environmentScene.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xd9e7ff, 0x17191c, 0.6));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
    key.position.set(-3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.normalBias = 0.04;
    key.shadow.radius = 4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x93b5f4, 1.3);
    rim.position.set(4, 3, -3);
    scene.add(rim);
    const warm = new THREE.PointLight(0xff6b32, 0.9, 8);
    warm.position.set(-3, 0.8, 2);
    scene.add(warm);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.35 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const sign = new THREE.Group();
    sign.position.y = 1.18;
    scene.add(sign);
    const frame = new THREE.Group(),
      back = new THREE.Group(),
      led = new THREE.Group(),
      front = new THREE.Group(),
      trim = new THREE.Group();
    [back, frame, led, front, trim].forEach((g) => sign.add(g));
    const steel = new THREE.MeshStandardMaterial({
      color: 0x484d54,
      metalness: 0.85,
      roughness: 0.28,
    });
    const brushed = new THREE.MeshStandardMaterial({
      color: 0xb4bbc4,
      metalness: 0.9,
      roughness: 0.3,
    });
    const edge = new THREE.MeshStandardMaterial({
      color: 0x252930,
      metalness: 0.8,
      roughness: 0.24,
    });
    const black = new THREE.MeshStandardMaterial({
      color: 0x181d23,
      metalness: 0.4,
      roughness: 0.45,
    });
    const orange = new THREE.MeshStandardMaterial({
      color: 0xe66532,
      metalness: 0.3,
      roughness: 0.35,
    });
    const white = new THREE.MeshStandardMaterial({
      color: 0xe6e5df,
      metalness: 0.15,
      roughness: 0.65,
    });
    function box(
      parent: THREE.Group,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      radius = 0.008,
    ) {
      const mesh = new THREE.Mesh(
        new RoundedBoxGeometry(
          w,
          h,
          d,
          2,
          Math.min(radius, w / 3, h / 3, d / 3),
        ),
        mat,
      );
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }
    const W = 3.25,
      H = 1.35,
      D = 0.3;
    // Structural steel frame, continuous profiles and central reinforcements.
    [-H / 2, H / 2].forEach((y) =>
      [-D / 2, D / 2].forEach((z) =>
        box(frame, W, 0.048, 0.048, 0, y, z, steel),
      ),
    );
    [-W / 2, W / 2].forEach((x) =>
      [-D / 2, D / 2].forEach((z) =>
        box(frame, 0.048, H, 0.048, x, 0, z, steel),
      ),
    );
    [-W / 2, W / 2].forEach((x) =>
      [-H / 2, H / 2].forEach((y) =>
        box(frame, 0.048, 0.048, D, x, y, 0, steel),
      ),
    );
    [-0.8, 0, 0.8].forEach((x) =>
      box(frame, 0.04, H, 0.04, x, 0, -0.13, steel),
    );
    box(back, W + 0.035, H + 0.035, 0.022, 0, 0, -0.19, brushed);
    [-1.3, 1.3].forEach((x) =>
      [-0.43, 0.43].forEach((y) => {
        box(back, 0.16, 0.12, 0.035, x, y, -0.23, steel);
        const bolt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.017, 0.017, 0.018, 6),
          brushed,
        );
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(x, y, -0.254);
        back.add(bolt);
      }),
    );
    // LED support rails, individual optical lenses and connected wiring.
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xfff8e1,
      emissive: 0xffdfaa,
      emissiveIntensity: 1.6,
      roughness: 0.2,
    });
    const wireMat = new THREE.LineBasicMaterial({ color: 0x9b3731 });
    for (let row = 0; row < 4; row++) {
      const y = -0.48 + row * 0.32;
      box(led, W - 0.16, 0.07, 0.018, 0, y, -0.05, white);
      for (let col = 0; col < 12; col++) {
        const x = -1.4 + col * 0.255;
        box(led, 0.11, 0.042, 0.018, x, y, -0.03, white);
        const lens = new THREE.Mesh(
          new THREE.SphereGeometry(0.021, 10, 6),
          lensMat,
        );
        lens.scale.z = 0.5;
        lens.position.set(x, y, -0.012);
        led.add(lens);
      }
      const points = [
        new THREE.Vector3(1.48, y, -0.015),
        new THREE.Vector3(1.52, y, -0.015),
        new THREE.Vector3(1.52, -0.52, -0.015),
      ];
      led.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          wireMat,
        ),
      );
    }
    box(led, 0.25, 0.105, 0.065, 1.18, -0.61, -0.04, brushed);
    for (let i = 0; i < 8; i++)
      box(
        led,
        0.01,
        0.065,
        0.004,
        1.09 + i * 0.024,
        -0.61,
        -0.004,
        black,
        0.001,
      );
    // Folded perimeter band and the face's continuous retaining frame.
    box(trim, W + 0.08, 0.045, D + 0.055, 0, H / 2 + 0.03, 0, edge);
    box(trim, W + 0.08, 0.045, D + 0.055, 0, -H / 2 - 0.03, 0, edge);
    [-W / 2 - 0.035, W / 2 + 0.035].forEach((x) =>
      box(trim, 0.045, H + 0.06, D + 0.055, x, 0, 0, edge),
    );
    box(trim, 0.022, H - 0.12, 0.006, -W / 2 - 0.06, 0, D / 2, orange, 0.001);
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 660;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f5f0e7";
    ctx.fillRect(0, 0, 1600, 660);
    ctx.fillStyle = "#ff6835";
    ctx.fillRect(110, 145, 20, 340);
    ctx.fillStyle = "#14161b";
    ctx.font = "bold 250px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GRAFO", 820, 360);
    ctx.fillStyle = "#4b4c50";
    ctx.font = "32px Arial";
    ctx.fillText("GRÁFICA DIGITAL INTELIGENTE", 820, 430);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const faceMat = new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: 0.45,
      metalness: 0,
      clearcoat: 0.18,
      emissiveMap: texture,
      emissive: 0xffffff,
      emissiveIntensity: 0.14,
    });
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.014, H - 0.014, 0.02),
      [white, white, white, white, faceMat, white],
    );
    face.position.z = D / 2 + 0.017;
    face.castShadow = true;
    front.add(face);
    const signLight = new THREE.PointLight(0xffedd0, 0.7, 4);
    signLight.position.set(0, 0, 0.4);
    front.add(signLight);

    let width = 0,
      height = 0;
    function resize() {
      width = container!.clientWidth;
      height = container!.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.fov = width < 580 ? 47 : 36;
      camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let running = false,
      visible = false,
      frameId = 0,
      p = target.current.progress,
      light = 1,
      last = 0;
    const render = (time: number) => {
      if (!running) return;
      const dt = Math.min((time - last) / 1000 || 1 / 60, 0.06);
      last = time;
      const blend = reduced.matches ? 1 : 1 - Math.exp(-dt * 6);
      p += (target.current.progress - p) * blend;
      light += ((target.current.illuminated ? 1 : 0) - light) * blend;
      front.position.z = p * 1.65;
      led.position.z = p * 0.65;
      back.position.z = -p * 0.85;
      trim.position.y = p * 0.3;
      trim.position.z = p * 0.05;
      front.rotation.y = p * -0.035;
      faceMat.emissiveIntensity = light * 0.14;
      lensMat.emissiveIntensity = 0.1 + light * 2;
      signLight.intensity = light * 0.6;
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    const sync = () => {
      const next = visible && !document.hidden;
      if (next === running) return;
      running = next;
      if (running) {
        last = 0;
        frameId = requestAnimationFrame(render);
      } else cancelAnimationFrame(frameId);
    };
    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { rootMargin: "100px" },
    );
    intersection.observe(container);
    document.addEventListener("visibilitychange", sync);
    const contextLost = (event: Event) => {
      event.preventDefault();
      running = false;
      cancelAnimationFrame(frameId);
      setUnavailable(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    return () => {
      running = false;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", sync);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      controls.dispose();
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material)
          (Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          ).forEach((m) => materials.add(m));
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      texture.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div
      ref={host}
      className="sign-canvas"
      role="img"
      aria-label="Modelo 3D ilustrativo de un cartel backlight con frente, iluminación LED, bastidor y fondo separados en capas"
    >
      {unavailable && (
        <div className="scene-fallback">
          <strong>Cada componente, conectado.</strong>
          <p>
            Frente, iluminación, estructura y fondo: explorá sus materiales y
            procesos en la descripción de las capas.
          </p>
          <span>La vista 3D requiere un navegador con WebGL.</span>
        </div>
      )}
    </div>
  );
}
