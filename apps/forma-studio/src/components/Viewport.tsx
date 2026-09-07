import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  createDisplayGeometry,
  fitCameraDepth,
  fitModelShadow,
  fitModelWorkplane,
} from "./viewport-rendering";
import type { Feature, Layer, Model, Project } from "../core/types";
import { assemblyOffset } from "../core/assembly";
import { releasedSnapPositions, snapReleaseProgress } from "../core/lightbox-snap";
import { lightboxMotion } from "../core/lightbox";
export type CameraView = "iso" | "top" | "side";
export type JointView = "separated" | "assembled" | "section";
interface Props {
  model: Model | null;
  modelScope: string;
  project: Project;
  explode: number;
  grid: boolean;
  view: CameraView;
  fit: number;
  jointView: JointView;
  boxSection?: boolean;
  dark: boolean;
  tool: "orbit" | "hole" | "pin";
  selected: string | null;
  focusedLayer: Layer | null;
  isolated: boolean;
  onPlace: (x: number, y: number) => void;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onError: (error: string) => void;
}
export function Viewport(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const state = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    group: THREE.Group;
    markers: THREE.Group;
    grid: THREE.GridHelper;
    plane: THREE.Mesh;
    render: () => void;
    updateShadow: () => void;
    fit: () => void;
    framedScope: string | null;
  } | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const node = host.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eef0f3");
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30000);
    camera.up.set(0, 0, 1);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      latest.current.onError(
        "No se pudo iniciar el visor 3D. Revisá la aceleración gráfica del navegador.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.localClippingEnabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    node.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "Visor 3D del diseño");
    renderer.domElement.setAttribute("role", "img");
    scene.add(new THREE.HemisphereLight("#ffffff", "#8793a0", 2.6));
    const sun = new THREE.DirectionalLight("#ffffff", 3.8);
    sun.position.set(-250, -300, 700);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight("#cedbec", 1.5);
    fill.position.set(600, 400, 350);
    scene.add(fill);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShadowMaterial({ opacity: 0.13, depthWrite: false }),
    );
    plane.position.z = -0.1;
    plane.scale.set(10000, 10000, 1);
    plane.receiveShadow = true;
    scene.add(plane);
    const grid = new THREE.GridHelper(100, 100, "#acb5bf", "#d4dae1");
    grid.scale.setScalar(2);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.2;
    const gridMaterials = Array.isArray(grid.material)
      ? grid.material
      : [grid.material];
    gridMaterials.forEach((material) => {
      material.depthWrite = false;
    });
    scene.add(grid);
    const group = new THREE.Group(),
      markers = new THREE.Group();
    scene.add(group, markers);
    const bounds = new THREE.Box3();
    const updateShadow = () => {
      bounds.makeEmpty();
      group.updateMatrixWorld(true);
      group.traverseVisible((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        bounds.union(
          object.geometry.boundingBox!.clone().applyMatrix4(object.matrixWorld),
        );
      });
      fitModelWorkplane(grid, plane, bounds);
      fitModelShadow(sun, bounds, plane.position.z);
    };
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.maxPolarAngle = Math.PI * 0.92;
    controls.minDistance = 12;
    controls.maxDistance = 10000;
    const render = () => {
      fitCameraDepth(camera, bounds, grid.scale.x * 100);
      renderer.render(scene, camera);
    };
    controls.addEventListener("change", render);
    const fit = () => {
      const box = new THREE.Box3().setFromObject(group),
        center = box.isEmpty()
          ? new THREE.Vector3(100, 40, 15)
          : box.getCenter(new THREE.Vector3()),
        size = box.isEmpty()
          ? new THREE.Vector3(260, 100, 40)
          : box.getSize(new THREE.Vector3());
      const span = Math.max(size.x / Math.max(camera.aspect, 0.5), size.y, size.z, 80);
      const distance = (span / Math.tan((camera.fov * Math.PI) / 360)) * 0.73;
      const view = latest.current.view;
      camera.position
        .copy(center)
        .add(
          latest.current.project.mode === "lightbox"
            ? view === "top" ? new THREE.Vector3(0,-distance,0.001) : view === "side" ? new THREE.Vector3(distance,0,distance*.1) : new THREE.Vector3(distance*.45,-distance*.95,distance*.5)
            : view === "top"
            ? new THREE.Vector3(0, -0.001, distance)
            : view === "side"
              ? new THREE.Vector3(distance, 0, distance * 0.15)
              : new THREE.Vector3(
                  size.x * 0.16,
                  -distance * 0.75,
                  distance * 0.83,
                ),
        );
      controls.target.copy(center);
      camera.lookAt(center);
      controls.update();
      render();
    };
    state.current = {
      scene,
      camera,
      renderer,
      controls,
      group,
      markers,
      grid,
      plane,
      render,
      updateShadow,
      fit,
      framedScope: null,
    };
    const resize = new ResizeObserver(() => {
      const width = node.clientWidth,
        height = node.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    });
    resize.observe(node);
    const raycaster = new THREE.Raycaster(),
      mouse = new THREE.Vector2();
    let down: [number, number] | null = null,
      drag: THREE.Object3D | null = null;
    const ray = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
    };
    const pointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      down = [e.clientX, e.clientY];
      ray(e);
      const hit = raycaster.intersectObjects(markers.children, true)[0];
      if (hit) {
        drag = hit.object;
        controls.enabled = false;
        latest.current.onSelect(drag.userData.id);
        renderer.domElement.setPointerCapture(e.pointerId);
      }
    };
    const point = (e: PointerEvent) => {
      ray(e);
      const target = new THREE.Vector3();
      return raycaster.ray.intersectPlane(
        new THREE.Plane(
          new THREE.Vector3(0, 0, 1),
          -latest.current.project.params.base,
        ).applyMatrix4(group.matrixWorld),
        target,
      )
        ? group.worldToLocal(target)
        : null;
    };
    const pointerMove = (e: PointerEvent) => {
      if (!drag) return;
      const pos = point(e);
      if (pos) {
        drag.position.x = pos.x;
        drag.position.y = pos.y;
        render();
      }
    };
    const pointerUp = (e: PointerEvent) => {
      if (drag) {
        latest.current.onMove(
          drag.userData.id,
          drag.position.x,
          drag.position.y,
        );
        drag = null;
        controls.enabled = true;
      } else if (
        down &&
        Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 4 &&
        latest.current.tool !== "orbit"
      ) {
        const pos = point(e);
        if (pos) latest.current.onPlace(pos.x, pos.y);
      }
      down = null;
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    fit();
    return () => {
      resize.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      sun.shadow.dispose();
      renderer.domElement.remove();
      state.current = null;
    };
  }, []);
  useEffect(() => {
    const s = state.current;
    if (!s) return;
    let active=true;
    while (s.group.children.length) {
      const child = s.group.children[0] as THREE.Mesh;
      s.group.remove(child);
      child.geometry.dispose();
      (child.material as THREE.MeshStandardMaterial).map?.dispose();
      (child.material as THREE.Material).dispose();
    }
    for (const part of props.model?.parts || []) {
      const geometry = createDisplayGeometry(part);
      const material = new THREE.MeshStandardMaterial({
        color: props.project.colors[part.layer],
        roughness: part.material === "acrylic" ? 0.32 : 0.64,
        metalness: 0.02,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.layer = part.layer;
      mesh.userData.partId = part.id;
      s.group.add(mesh);
      const art=part.layer==="faceA"?props.project.faceArtwork?.a:part.layer==="faceB"?props.project.faceArtwork?.b:undefined;
      if(art){
        const position=geometry.getAttribute("position");
        const uv=new Float32Array(position.count*2);
        const side=part.layer==="faceA"?1:-1;
        const faceZ=side===1?part.bounds.max[2]:part.bounds.min[2];
        const diameter=part.bounds.max[0]-part.bounds.min[0];
        for(let i=0;i<position.count;i+=3){
          const isFace=[0,1,2].every(k=>Math.abs(position.getZ(i+k)-faceZ)<.002);
          if(isFace)for(let k=0;k<3;k++)uv.set([.5+side*position.getX(i+k)/diameter,.5+position.getY(i+k)/diameter],(i+k)*2);
        }
        geometry.setAttribute("uv",new THREE.BufferAttribute(uv,2));
        new THREE.ImageLoader().load(art,img=>{
          if(!active)return;
          const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=1024;
          const context=canvas.getContext("2d");if(!context)return;
          context.fillStyle="#ffffff";context.fillRect(0,0,1024,1024);
          const ratio=Math.min(1020/img.width,1020/img.height);
          context.drawImage(img,(1024-img.width*ratio)/2,(1024-img.height*ratio)/2,img.width*ratio,img.height*ratio);
          const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
          material.map=texture;material.needsUpdate=true;s.render();
        });
      }
    }
    return ()=>{active=false;};
  }, [props.model,props.project.faceArtwork]);
  useEffect(() => {
    const s = state.current;
    if (!s) return;
    const flipped = props.model?.frontDirection === -1;
    const parts = props.model?.parts || [];
    s.group.rotation.set(0, flipped ? Math.PI : 0, 0);
    s.group.position.set(
      flipped && parts.length
        ? Math.min(...parts.map((p) => p.bounds.min[0])) +
            Math.max(...parts.map((p) => p.bounds.max[0]))
        : 0,
      0,
      flipped && parts.length
        ? Math.max(...parts.map((p) => p.bounds.max[2])) +
            Math.min(...parts.map((p) => p.bounds.min[2]))
        : 0,
    );
    if(props.project.mode==="lightbox"){
      s.group.rotation.set(Math.PI/2,0,0);
      s.group.position.set(0,props.project.lightbox.depth/2,props.project.lightbox.diameter/2);
    }
    s.markers.rotation.copy(s.group.rotation);
    s.markers.position.copy(s.group.position);
    for (const child of s.group.children) {
      const mesh = child as THREE.Mesh;
      const layer = mesh.userData.layer as keyof Project["colors"];
      (mesh.material as THREE.MeshStandardMaterial).color.set(
        props.project.colors[layer],
      );
      mesh.visible =
        props.isolated && props.focusedLayer
          ? layer === props.focusedLayer
          : !props.project.hidden.includes(layer);
      const displayMaterial = mesh.material as THREE.MeshStandardMaterial;
      displayMaterial.emissive.set(
        layer === props.focusedLayer ? "#fd6900" : "#000000",
      );
      displayMaterial.emissiveIntensity =
        layer === props.focusedLayer ? 0.18 : 0;
      mesh.rotation.set(0, 0, 0);
      mesh.position.set(0, 0, 0);
      const part = props.model?.parts.find(
        (p) => p.id === mesh.userData.partId,
      );
      mesh.position.z = assemblyOffset(
        props.project,
        layer,
        part?.assemblyDirection ?? 0,
        props.explode,
      );
      if(props.project.mode==="lightbox"&&part){
        mesh.position.fromArray(lightboxMotion(part,props.explode));
        const release=snapReleaseProgress(props.explode);
        if(part.snapTabs&&mesh.userData.snapRelease!==release){
          mesh.geometry.dispose();
          mesh.geometry=createDisplayGeometry({...part,positions:releasedSnapPositions(part,props.explode)});
          mesh.userData.snapRelease=release;
        }
      }
      if (props.project.mode === "joint" && props.jointView !== "separated") {
        const j = props.project.joint;
        mesh.rotation.x = (-j.tilt * Math.PI) / 180;
        if (layer === "socket")
          mesh.position.x = -(j.flangeLength / 2 + j.socketFlange / 2 + 12);
        if (layer === "pin") {
          mesh.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), Math.PI);
          const center =
            j.flangeHeight +
            j.baseHeight +
            j.neckHeight +
            Math.sqrt(Math.max(0, (j.ball / 2) ** 2 - (j.neck / 2) ** 2));
          const cavityR = (j.ball + j.clearance) / 2,
            openingR = Math.max(0.5, j.ball / 2 - j.retention);
          const sphereZ =
            j.socketHeight -
            Math.sqrt(Math.max(0, cavityR ** 2 - openingR ** 2));
          mesh.position.z = center + sphereZ;
        }
      }
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.clippingPlanes =
        props.project.mode === "lightbox" && props.boxSection
          ? [new THREE.Plane(new THREE.Vector3(0,0,-1),props.project.lightbox.diameter/2)]
          : props.project.mode === "joint" && props.jointView === "section"
          ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)]
          : [];
      material.side =
        props.jointView === "section" || props.boxSection ? THREE.DoubleSide : THREE.FrontSide;
    }
    s.grid.visible = props.grid;
    s.controls.enableRotate = props.tool === "orbit";
    s.renderer.domElement.style.cursor =
      props.tool === "orbit" ? "grab" : "crosshair";
    s.updateShadow();
    s.render();
  }, [
    props.project.colors,
    props.focusedLayer,
    props.isolated,
    props.project.hidden,
    props.explode,
    props.grid,
    props.tool,
    props.model,
    props.jointView,
    props.project.mode,
    props.project.joint,
    props.project.lightbox,
    props.project.faceArtwork,
    props.boxSection,
  ]);
  useEffect(() => {
    const s = state.current;
    if (!s) return;
    s.scene.background = new THREE.Color(props.dark ? "#202933" : "#eef0f3");
    const gridMaterials = Array.isArray(s.grid.material)
      ? s.grid.material
      : [s.grid.material];
    for (const material of gridMaterials) {
      material.transparent = true;
      material.opacity = props.dark ? 0.16 : 0.65;
      material.needsUpdate = true;
    }
    s.render();
  }, [props.dark]);
  useEffect(() => {
    const s = state.current;
    if (!s) return;
    while (s.markers.children.length) {
      const child = s.markers.children[0] as THREE.Mesh;
      s.markers.remove(child);
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
    for (const f of props.project.mode !== "letters"
      ? []
      : props.project.features) {
      const marker = new THREE.Mesh(
        new THREE.TorusGeometry(
          f.type === "hole"
            ? f.diameter / 2
            : props.project.params.pinDiameter / 2,
          0.55,
          6,
          32,
        ),
        new THREE.MeshBasicMaterial({
          color: f.id === props.selected ? "#f7a947" : "#bb584c",
          depthTest: false,
        }),
      );
      marker.position.set(f.x, f.y, props.project.params.base + 0.1);
      marker.userData.id = f.id;
      marker.renderOrder = 50;
      s.markers.add(marker);
    }
    s.render();
  }, [
    props.project.features,
    props.selected,
    props.project.params.base,
    props.project.params.pinDiameter,
    props.project.mode,
  ]);
  useEffect(() => {
    const s = state.current;
    // Encuadrar sólo la primera geometría de este proyecto/modo. Las nuevas
    // mallas conservan posición, rotación, zoom y objetivo de OrbitControls.
    if (s && props.model?.parts.length && s.framedScope !== props.modelScope) {
      s.framedScope = props.modelScope;
      s.fit();
    }
  }, [props.model, props.modelScope]);
  useEffect(
    () => state.current?.fit(),
    [props.view, props.fit, props.jointView],
  );
  return <div className="viewport-canvas" ref={host} />;
}
