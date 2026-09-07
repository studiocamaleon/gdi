import * as THREE from "three";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import type { Part } from "../core/types";

export function createDisplayGeometry(
  part: Pick<Part, "positions" | "indices">,
) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(part.positions, 3),
  );
  const indices = new Uint32Array(part.indices.length);
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  let count = 0;
  for (let i = 0; i < part.indices.length; i += 3) {
    a.fromArray(part.positions, part.indices[i] * 3);
    b.fromArray(part.positions, part.indices[i + 1] * 3);
    c.fromArray(part.positions, part.indices[i + 2] * 3);
    if (b.sub(a).cross(c.sub(a)).lengthSq() === 0) continue;
    indices.set(part.indices.subarray(i, i + 3), count);
    count += 3;
  }
  geometry.setIndex(new THREE.BufferAttribute(indices.subarray(0, count), 1));
  // Las aristas de fabricación deben seguir siendo duras. Promediar sus
  // normales con las del frente deforma la iluminación y la autosombra.
  const display = toCreasedNormals(geometry, Math.PI / 4);
  geometry.dispose();
  return display;
}

const sunDirection = new THREE.Vector3(-250, -300, 700).normalize();

// Con near fijo en 0,1 mm, el buffer de profundidad pierde milímetros de
// precisión al alejarse varios metros. Dos caras distintas acaban en la misma
// profundidad y sus triángulos se alternan. Reservar el rango para la vista
// actual mantiene visibles las holguras, sin desplazar las piezas.
export function fitCameraDepth(
  camera: THREE.PerspectiveCamera,
  bounds: THREE.Box3,
  environmentRadius: number,
) {
  if (bounds.isEmpty()) return;
  camera.updateMatrixWorld();
  let nearest = Infinity,
    farthest = -Infinity;
  const point = new THREE.Vector3();
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        point.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        nearest = Math.min(nearest, -point.z);
        farthest = Math.max(farthest, -point.z);
      }
  const near = Math.max(0.01, nearest > 0 ? nearest * 0.5 : 0.01);
  const distance = camera.position.distanceTo(bounds.getCenter(point));
  const far = Math.max(near + 1, farthest * 1.25, distance + environmentRadius);
  if (camera.near === near && camera.far === far) return;
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
}

// Cuadrícula base de 100 celdas de 1 mm y plano base de 1 × 1 mm.
// Ajustar el entorno, nunca las coordenadas de las piezas de fabricación.
export function fitModelWorkplane(
  grid: THREE.GridHelper,
  plane: THREE.Mesh,
  bounds: THREE.Box3,
) {
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const targetStep = Math.max(2, (Math.max(size.x, size.y) * 1.5) / 100);
  const magnitude = 10 ** Math.floor(Math.log10(targetStep));
  const step =
    [1, 2, 5, 10].find((multiple) => multiple * magnitude >= targetStep)! *
    magnitude;

  // Pasos de 1/2/5 × 10ⁿ y centro alineado a ellos: la escala sigue en mm
  // sin agregar miles de líneas cuando el cartel es grande.
  grid.scale.setScalar(step);
  grid.position.x = Math.round(center.x / step) * step;
  grid.position.y = Math.round(center.y / step) * step;
  // El montaje puede retirar el fondo hacia Z negativo. El piso acompaña
  // la pieza inferior sin taparla ni trasladar el modelo o su cámara.
  grid.position.z = bounds.min.z - 0.2;
  plane.position.z = bounds.min.z - 0.1;
  plane.position.x = grid.position.x;
  plane.position.y = grid.position.y;
  const floorSize = Math.max(10000, step * 200, Math.abs(bounds.max.z) * 4);
  plane.scale.set(floorSize, floorSize, 1);
}

export function fitModelShadow(
  light: THREE.DirectionalLight,
  bounds: THREE.Box3,
  floorZ: number,
) {
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(1, bounds.getSize(new THREE.Vector3()).length() / 2);
  light.target.position.copy(center);
  light.position.copy(center).addScaledVector(sunDirection, radius * 3 + 10);
  light.updateMatrixWorld();
  light.target.updateMatrixWorld();
  light.shadow.updateMatrices(light);

  const camera = light.shadow.camera;
  const shadowBounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        point.set(x, y, z);
        shadowBounds.expandByPoint(
          point.clone().applyMatrix4(camera.matrixWorldInverse),
        );
        // Incluir la sombra proyectada en el piso, también durante el despiece.
        point.addScaledVector(sunDirection, (floorZ - z) / sunDirection.z);
        shadowBounds.expandByPoint(
          point.applyMatrix4(camera.matrixWorldInverse),
        );
      }
  const size = shadowBounds.getSize(new THREE.Vector3());
  const padding = Math.max(1, Math.max(size.x, size.y) * 0.04);
  camera.left = shadowBounds.min.x - padding;
  camera.right = shadowBounds.max.x + padding;
  camera.bottom = shadowBounds.min.y - padding;
  camera.top = shadowBounds.max.y + padding;
  camera.near = Math.max(0.1, -shadowBounds.max.z - padding);
  camera.far = Math.max(camera.near + 1, -shadowBounds.min.z + padding);
  camera.updateProjectionMatrix();
  const texel = Math.max(
    (camera.right - camera.left) / light.shadow.mapSize.x,
    (camera.top - camera.bottom) / light.shadow.mapSize.y,
  );
  // El margen sigue la resolución real sobre la pieza, en milímetros.
  light.shadow.normalBias = Math.max(0.02, texel * 1.5);
  light.shadow.bias = -0.00005;
}
