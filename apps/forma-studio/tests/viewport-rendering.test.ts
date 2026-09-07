import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createDisplayGeometry,
  fitCameraDepth,
  fitModelShadow,
  fitModelWorkplane,
} from "../src/components/viewport-rendering";

const cube = {
  positions: new Float32Array([
    0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0,
    10, 10,
  ]),
  indices: new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2,
    3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
  ]),
};

describe("Precisión de profundidad al cambiar el zoom", () => {
  it.each([500, 4000, 10000, 100000])(
    "separa superficies a 0,1 mm desde %s mm y conserva todo el modelo",
    (distance) => {
      const camera = new THREE.PerspectiveCamera(36, 1.5, 0.1, 30000);
      const bounds = new THREE.Box3(
        new THREE.Vector3(-1320.2, -507.5, 0),
        new THREE.Vector3(1320.2, 507.5, 35.7),
      );
      const center = bounds.getCenter(new THREE.Vector3());
      camera.position.copy(center).add(new THREE.Vector3(0, 0, distance));
      camera.lookAt(center);
      fitCameraDepth(camera, bounds, 5000);
      const a = center.clone().project(camera);
      const b = center
        .clone()
        .add(new THREE.Vector3(0, 0, 0.1))
        .project(camera);
      // Al menos 8 niveles distintos en un buffer convencional de 24 bits.
      expect(Math.abs(a.z - b.z) * 0.5 * (2 ** 24 - 1)).toBeGreaterThan(8);
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z])
            expect(
              Math.abs(new THREE.Vector3(x, y, z).project(camera).z),
            ).toBeLessThan(1);
    },
  );

  it("permite acercarse, orbitar y entrar entre piezas en despiece", () => {
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30000);
    const bounds = new THREE.Box3(
      new THREE.Vector3(-500, -200, -60),
      new THREE.Vector3(500, 200, 300),
    );
    for (const position of [
      [800, -1600, 900],
      [0, -12, 150],
      [0, 0, 120],
    ]) {
      camera.position.set(...(position as [number, number, number]));
      camera.lookAt(0, 0, 100);
      fitCameraDepth(camera, bounds, 2000);
      expect(camera.near).toBeGreaterThan(0);
      expect(camera.far).toBeGreaterThan(camera.near);
      expect(new THREE.Vector3(0, 0, 100).project(camera).z).toBeGreaterThan(
        -1,
      );
      expect(new THREE.Vector3(0, 0, 100).project(camera).z).toBeLessThan(1);
    }
  });
});

describe("Superficies del visor", () => {
  it("mantiene planos y aristas a 90° sin alterar los datos de fabricación", () => {
    const source = {
      positions: cube.positions.slice(),
      indices: cube.indices.slice(),
    };
    const geometry = createDisplayGeometry(cube);
    const positions = geometry.getAttribute("position"),
      normals = geometry.getAttribute("normal");
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    for (let i = 0; i < positions.count; i += 3) {
      a.fromBufferAttribute(positions, i);
      b.fromBufferAttribute(positions, i + 1);
      c.fromBufferAttribute(positions, i + 2);
      const faceNormal = b.sub(a).cross(c.sub(a)).normalize();
      for (let n = 0; n < 3; n++) {
        expect(
          new THREE.Vector3()
            .fromBufferAttribute(normals, i + n)
            .dot(faceNormal),
        ).toBeCloseTo(1, 6);
        expect([
          positions.getX(i + n),
          positions.getY(i + n),
          positions.getZ(i + n),
        ]).toEqual(
          Array.from(
            cube.positions.subarray(
              cube.indices[i + n] * 3,
              cube.indices[i + n] * 3 + 3,
            ),
          ),
        );
      }
    }
    expect(cube).toEqual(source);
    geometry.dispose();
  });

  it("suaviza una pared curva sin mezclar sus normales con las tapas", () => {
    const cylinder = new THREE.CylinderGeometry(10, 10, 20, 48);
    const geometry = createDisplayGeometry({
      positions: new Float32Array(cylinder.getAttribute("position").array),
      indices: new Uint32Array(cylinder.index!.array),
    });
    const positions = geometry.getAttribute("position"),
      normals = geometry.getAttribute("normal");
    for (let i = 0; i < positions.count; i += 3) {
      const side =
        positions.getY(i) !== positions.getY(i + 1) ||
        positions.getY(i) !== positions.getY(i + 2);
      for (let j = i; j < i + 3; j++) {
        const normal = new THREE.Vector3().fromBufferAttribute(normals, j);
        expect(normal.length()).toBeCloseTo(1, 5);
        if (side) {
          expect(normal.y).toBeCloseTo(0, 6);
          const radial = new THREE.Vector3(
            positions.getX(j),
            0,
            positions.getZ(j),
          ).normalize();
          expect(normal.dot(radial)).toBeGreaterThan(0.999);
        } else expect(Math.abs(normal.y)).toBeCloseTo(1, 6);
      }
    }
    cylinder.dispose();
    geometry.dispose();
  });

  it("excluye triángulos colapsados del render para no introducir normales nulas", () => {
    const geometry = createDisplayGeometry({
      ...cube,
      indices: new Uint32Array([...cube.indices, 0, 0, 0]),
    });
    expect(geometry.getAttribute("position").count).toBe(cube.indices.length);
    const normals = geometry.getAttribute("normal");
    for (let i = 0; i < normals.count; i++)
      expect(
        new THREE.Vector3().fromBufferAttribute(normals, i).length(),
      ).toBeCloseTo(1, 6);
    geometry.dispose();
  });
});

describe("Sombras a escala del modelo", () => {
  it.each([
    ["encastre pequeño", [-16, -16, 0], [68, 16, 26]],
    ["cartel grande", [0, 0, 0], [3000, 500, 50]],
    ["piezas en despiece", [300, -200, -60], [1000, 200, 200]],
  ] as const)(
    "incluye el %s y su sombra en el piso sin desperdiciar el mapa",
    (_, min, max) => {
      const light = new THREE.DirectionalLight();
      light.shadow.mapSize.set(2048, 2048);
      const bounds = new THREE.Box3(
        new THREE.Vector3(...min),
        new THREE.Vector3(...max),
      );
      fitModelShadow(light, bounds, -0.1);
      light.shadow.updateMatrices(light);
      const camera = light.shadow.camera;
      const direction = light.position
        .clone()
        .sub(light.target.position)
        .normalize();
      for (const x of [min[0], max[0]])
        for (const y of [min[1], max[1]])
          for (const z of [min[2], max[2]]) {
            const corner = new THREE.Vector3(x, y, z);
            const floor = corner
              .clone()
              .addScaledVector(direction, (-0.1 - z) / direction.z);
            for (const point of [corner, floor]) {
              point.project(camera);
              expect(
                Math.max(
                  Math.abs(point.x),
                  Math.abs(point.y),
                  Math.abs(point.z),
                ),
              ).toBeLessThan(1);
            }
          }
      expect(camera.near).toBeGreaterThan(0);
      expect(camera.far).toBeGreaterThan(camera.near);
      expect(light.shadow.normalBias).toBeGreaterThan(0);
      if (max[0] < 100) expect(camera.right - camera.left).toBeLessThan(150);
    },
  );
});

describe("Cuadrícula que contiene el diseño", () => {
  it.each([
    ["GRAFO de la captura", [0, 0, 0], [2640.4, 1015, 38]],
    ["encastre pequeño", [-16, -16, 0], [68, 16, 26]],
    ["SVG desplazado", [-18000, 9000, 0], [-15300, 9600, 50]],
    ["PVC retirado hacia atrás", [0, 0, -80], [160, 100, 45]],
    [
      "cartel mayor que el piso anterior",
      [-65000, -20000, 0],
      [25000, 18000, 70],
    ],
  ] as const)("incluye %s sin mover o escalar el modelo", (_, min, max) => {
    const grid = new THREE.GridHelper(100, 100);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.2;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial(),
    );
    plane.position.z = -0.1;
    const bounds = new THREE.Box3(
      new THREE.Vector3(...min),
      new THREE.Vector3(...max),
    );
    const original = bounds.clone();
    const geometry = grid.geometry;
    try {
      // Reutilizar la cuadrícula también después de cambiar tamaño o posición.
      fitModelWorkplane(
        grid,
        plane,
        new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(10, 10, 10)),
      );
      fitModelWorkplane(grid, plane, bounds);
      expect(bounds.equals(original)).toBe(true);
      expect(grid.geometry).toBe(geometry);
      expect(grid.geometry.getAttribute("position").count).toBeLessThan(500);
      const gridBounds = new THREE.Box3().setFromObject(grid);
      const floorBounds = new THREE.Box3().setFromObject(plane);
      const margin = Math.max(max[0] - min[0], max[1] - min[1]) * 0.2;
      for (const axis of ["x", "y"] as const) {
        expect(gridBounds.min[axis]).toBeLessThanOrEqual(
          bounds.min[axis] - margin,
        );
        expect(gridBounds.max[axis]).toBeGreaterThanOrEqual(
          bounds.max[axis] + margin,
        );
        expect(floorBounds.min[axis]).toBeLessThanOrEqual(gridBounds.min[axis]);
        expect(floorBounds.max[axis]).toBeGreaterThanOrEqual(
          gridBounds.max[axis],
        );
      }
      expect(grid.position.z).toBe(min[2] - 0.2);
      expect(plane.position.z).toBe(min[2] - 0.1);
    } finally {
      grid.geometry.dispose();
      const materials = Array.isArray(grid.material)
        ? grid.material
        : [grid.material];
      materials.forEach((material) => material.dispose());
      plane.geometry.dispose();
      plane.material.dispose();
    }
  });
});
