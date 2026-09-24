"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import styles from "./grafo3d-section.module.css";

type DemoPart = {
  layer: string;
  color: string;
  positions: number[];
  indices: number[];
};
type DemoModel = { frontDirection: number; parts: DemoPart[] };

export default function Grafo3DDemoScene({ progress, onReady, onUnavailable }: {
  progress: number;
  onReady: () => void;
  onUnavailable: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const applyProgress = useRef<((progress: number) => void) | null>(null);
  const latest = useRef({ progress, onReady, onUnavailable });
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    latest.current = { progress, onReady, onUnavailable };
    applyProgress.current?.(progress);
  }, [progress, onReady, onUnavailable]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const abort = new AbortController();
    let disposed = false;
    let cleanup = () => {};
    const fail = () => {
      if (disposed) return;
      setUnavailable(true);
      latest.current.onUnavailable();
    };

    async function start() {
      const response = await fetch("/demos/grafoprint-assembly.json", { signal: abort.signal });
      if (!response.ok) throw new Error("Modelo no disponible");
      const model: DemoModel = await response.json();
      if (disposed || !container) return;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute("aria-label", "Isologo de Grafoprint en 3D: cuerpo, frente acrílico y base desmontable");

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-180, 180, 180, -180, 1, 2000);
      camera.up.set(0, 0, 1);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableDamping = false;
      controls.minPolarAngle = Math.PI * 0.12;
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.rotateSpeed = 0.6;
      controls.enabled = window.matchMedia("(pointer: fine)").matches;
      renderer.domElement.style.touchAction = "pan-y";
      const group = new THREE.Group();
      scene.add(group);
      const meshes = model.parts.map((part) => {
        const indexed = new THREE.BufferGeometry();
        indexed.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
        indexed.setIndex(part.indices);
        const geometry = toCreasedNormals(indexed, Math.PI / 4);
        indexed.dispose();
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(part.color).convertSRGBToLinear(),
          roughness: part.layer === "face" ? 0.3 : 0.62,
          metalness: part.layer === "back" ? 0.15 : 0.04,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
      });
      // Se conserva la orientación del modelo generado por Grafo3D.
      if (model.frontDirection === -1) group.rotation.y = Math.PI;
      const bounds = new THREE.Box3().setFromObject(group);
      const center = bounds.getCenter(new THREE.Vector3());
      group.position.sub(center);
      const focus = new THREE.Vector3(0, 0, 5);
      camera.position.copy(focus).add(new THREE.Vector3(65, -320, 480));
      controls.target.copy(focus);
      controls.update();

      scene.add(new THREE.HemisphereLight(0xffffff, 0x8f949b, 0.85));
      const sun = new THREE.DirectionalLight(0xfff7ec, 1.4);
      sun.position.set(-200, -300, 500);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -240, right: 240, top: 240, bottom: -240, near: 1, far: 1200 });
      sun.shadow.normalBias = 0.08;
      scene.add(sun, sun.target);
      const fill = new THREE.DirectionalLight(0xdde8ff, 0.45);
      fill.position.set(300, 200, 250);
      scene.add(fill);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.ShadowMaterial({ opacity: 0.10, depthWrite: false }),
      );
      floor.position.z = -130;
      floor.receiveShadow = true;
      scene.add(floor);
      const render = () => renderer.render(scene, camera);
      controls.addEventListener("change", render);
      const resize = new ResizeObserver(() => {
        const width = container.clientWidth, height = container.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height);
        const aspect = width / height;
        const halfHeight = Math.max(185, 155 / aspect);
        camera.left = -halfHeight * aspect;
        camera.right = halfHeight * aspect;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.updateProjectionMatrix();
        render();
      });
      resize.observe(container);
      applyProgress.current = (value) => {
        const separation = Math.min(1, Math.max(0, value));
        model.parts.forEach((part, index) => {
          // Despiece de presentación: frente arriba y base abajo del cuerpo.
          // La rotación del grupo invierte Z en los encastres traseros; se
          // compensa aquí, sin cambiar la extracción de fabricación del editor.
          const travel = part.layer === "face" ? 115 : part.layer === "back" ? -100 : 0;
          meshes[index].position.z = travel * separation * model.frontDirection;
        });
        render();
      };
      const contextLost = (event: Event) => { event.preventDefault(); fail(); };
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      cleanup = () => {
        applyProgress.current = null;
        resize.disconnect();
        controls.removeEventListener("change", render);
        controls.dispose();
        meshes.forEach((mesh) => { mesh.geometry.dispose(); mesh.material.dispose(); });
        floor.geometry.dispose();
        floor.material.dispose();
        sun.shadow.map?.dispose();
        renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        renderer.dispose();
        renderer.domElement.remove();
      };
      applyProgress.current(latest.current.progress);
      latest.current.onReady();
    }
    start().catch((error) => { if (error.name !== "AbortError") fail(); });
    return () => { disposed = true; abort.abort(); cleanup(); };
  }, []);

  return (
    <div className={styles.scene}>
      <div ref={host} className={styles.canvas} hidden={unavailable} />
      {unavailable && <div className={styles.fallback}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/demos/grafoprint-isologo.svg" width="120" height="120" alt="Isologo de Grafoprint" />
        <p>La vista 3D no está disponible en este navegador.</p>
        <a href="/3d?ejemplo=grafoprint">Abrir el ejemplo en Grafo3D</a>
      </div>}
    </div>
  );
}
