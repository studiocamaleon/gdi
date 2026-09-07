import { afterEach, describe, expect, it, vi } from "vitest";

await vi.hoisted(async () => {
  const { parseHTML } = await import("linkedom");
  const { window } = parseHTML("<html><body></body></html>");
  Object.defineProperty(window, "location", {
    value: new URL("http://localhost/"),
    configurable: true,
  });
  for (const key of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLInputElement",
    "Node",
  ] as const)
    vi.stubGlobal(key, key === "window" ? window : window[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: () => void) {}
      observe() {
        this.callback();
      }
      disconnect() {}
    },
  );
  Object.defineProperty(window.HTMLElement.prototype, "clientWidth", {
    get: () => 800,
  });
  Object.defineProperty(window.HTMLElement.prototype, "clientHeight", {
    get: () => 600,
  });
});

const display = vi.hoisted(() => ({
  scene: null as import("three").Scene | null,
  camera: null as import("three").PerspectiveCamera | null,
  controls: null as
    import("three/addons/controls/OrbitControls.js").OrbitControls | null,
  renders: 0,
}));
// Sólo se sustituye el acceso a GPU. La cámara, OrbitControls, sólidos y
// efectos del componente son reales para detectar reencuadres involuntarios.
vi.mock("three", async (original) => ({
  ...(await original<typeof import("three")>()),
  WebGLRenderer: class {
    domElement = document.createElement("canvas");
    shadowMap = {};
    setPixelRatio() {}
    setSize() {}
    render(
      scene: import("three").Scene,
      camera: import("three").PerspectiveCamera,
    ) {
      display.scene = scene;
      display.camera = camera;
      display.renders++;
    }
    dispose() {}
  },
}));
vi.mock("three/addons/controls/OrbitControls.js", async (original) => {
  const { OrbitControls } =
    await original<typeof import("three/addons/controls/OrbitControls.js")>();
  return {
    OrbitControls: class extends OrbitControls {
      constructor(...args: ConstructorParameters<typeof OrbitControls>) {
        super(...args);
        display.controls = this;
      }
    },
  };
});

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BoxGeometry, Box3, Vector3, Mesh } from "three";
import { Viewport } from "../src/components/Viewport";
import { newProject } from "../src/core/project";
import type { Model } from "../src/core/types";

let root: Root;
let container: HTMLDivElement;
afterEach(async () => {
  if (root) await act(() => root.unmount());
  container?.remove();
});
function model(width = 100, height = 35): Model {
  const geometry = new BoxGeometry(width, 80, height).translate(
    width / 2,
    40,
    height / 2,
  );
  const result: Model = {
    parts: [
      {
        id: "body",
        name: "Cuerpo",
        layer: "body",
        material: "filament",
        positions: new Float32Array(geometry.getAttribute("position").array),
        indices: new Uint32Array(geometry.index!.array),
        bounds: { min: [0, 0, 0], max: [width, 80, height] },
        volume: width * 80 * height,
        surface: 0,
        contours: [],
        area: 0,
        perimeter: 0,
      },
    ],
    warnings: [],
    width,
    height: 80,
    depth: height,
    duration: 1,
  };
  geometry.dispose();
  return result;
}
async function mount(initialModel: Model | null = model()) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  let props: ComponentProps<typeof Viewport> = {
    project: newProject(),
    model: initialModel,
    modelScope: "project-a:letters",
    explode: 0,
    grid: true,
    view: "iso",
    fit: 0,
    jointView: "separated",
    dark: false,
    tool: "orbit",
    selected: null,
    focusedLayer: null,
    isolated: false,
    onPlace: vi.fn(),
    onSelect: vi.fn(),
    onMove: vi.fn(),
    onError: vi.fn(),
  };
  const update = async (changes: Partial<typeof props>) => {
    props = { ...props, ...changes };
    await act(() => root.render(<Viewport {...props} />));
    expect(props.onError).not.toHaveBeenCalled();
  };
  await update({});
  return update;
}
function pose() {
  return {
    position: display.camera!.position.toArray(),
    rotation: display.camera!.quaternion.toArray(),
    zoom: display.camera!.zoom,
    target: display.controls!.target.toArray(),
  };
}
function orbit() {
  display.camera!.position.set(180, -250, 160);
  display.camera!.zoom = 1.4;
  display.controls!.target.set(60, 25, 12);
  display.controls!.update();
}
function expectTarget(expected: number[]) {
  display
    .controls!.target.toArray()
    .forEach((value, i) => expect(value).toBeCloseTo(expected[i], 8));
}

describe("Conservación de cámara al editar", () => {
  it("reemplaza la geometría y actualiza profundidad sin mover la cámara del usuario", async () => {
    const update = await mount();
    orbit();
    const before = pose();
    const near = display.camera!.near;
    const rendered = display.renders;
    await update({ model: model(180, 65) });
    expect(pose()).toEqual(before);
    expect(display.camera!.near).not.toBe(near);
    expect(display.renders).toBeGreaterThan(rendered);
    await update({
      model: model(120, 20),
      explode: 35,
      focusedLayer: "body",
      isolated: true,
    });
    expect(pose()).toEqual(before);
  });

  it("encuadra la primera geometría cuando llega de forma asíncrona, una sola vez", async () => {
    const update = await mount(null);
    const empty = pose();
    await update({ model: model(300, 50) });
    expect(pose()).not.toEqual(empty);
    expectTarget([150, 40, 25]);
    orbit();
    const before = pose();
    await update({ model: model(600, 80) });
    expect(pose()).toEqual(before);
  });

  it("mantiene disponibles Encuadrar modelo y las vistas explícitas", async () => {
    const update = await mount();
    orbit();
    const before = pose();
    await update({ fit: 1 });
    expect(pose()).not.toEqual(before);
    expectTarget([50, 40, 17.5]);
    await update({ view: "top" });
    expect(display.camera!.position.x).toBeCloseTo(50);
    expect(display.camera!.position.y).toBeCloseTo(39.999);
    const top = pose();
    await update({ model: model(100, 60) });
    expect(pose()).toEqual(top);
  });

  it("encuadra el resultado de un nuevo proyecto o modo y conserva sus ediciones siguientes", async () => {
    const update = await mount();
    orbit();
    await update({ modelScope: "project-b:letters", model: model(400, 30) });
    expectTarget([200, 40, 15]);
    orbit();
    await update({ modelScope: "project-b:joint", model: model(40, 20) });
    expectTarget([20, 40, 10]);
    orbit();
    const before = pose();
    await update({ model: model(50, 30) });
    expect(pose()).toEqual(before);
  });
});

it("presenta el frente hacia arriba y retira el acrílico por atrás sin mover la cámara", async () => {
  const assembly = model();
  assembly.frontDirection = -1;
  assembly.parts[0].assemblyDirection = 0;
  const face = model(100, 3).parts[0];
  Object.assign(face, { id: "face", layer: "face", assemblyDirection: 1 });
  assembly.parts.push(face);
  const update = await mount(assembly);
  const project = newProject();
  project.features = [
    {
      id: "hole-1",
      type: "hole",
      x: 20,
      y: 30,
      shape: "circle",
      diameter: 5,
      width: 5,
      height: 5,
      radius: 0,
    },
  ];
  await update({ project });
  const meshes: Mesh[] = [];
  display.scene!.traverse((o) => {
    if (o instanceof Mesh && o.userData.partId) meshes.push(o);
  });
  const shownFace = meshes.find((m) => m.userData.partId === "face")!;
  const shownBody = meshes.find((m) => m.userData.partId === "body")!;
  const bodyBox = new Box3().setFromObject(shownBody);
  expect(new Box3().setFromObject(shownFace).max.z).toBeCloseTo(35, 5);
  expect(
    new Vector3(0, 0, -1).transformDirection(shownFace.matrixWorld).z,
  ).toBeCloseTo(1, 5);
  let markerWorld: Vector3 | undefined;
  display.scene!.traverse((o) => {
    if (o.userData.id === "hole-1")
      markerWorld = o.getWorldPosition(new Vector3());
  });
  expect(markerWorld!.x).toBeCloseTo(80, 5);
  expect(markerWorld!.z).toBeCloseTo(35 - project.params.base - 0.1, 5);
  orbit();
  const before = pose();
  await update({ explode: 60 });
  expect(pose()).toEqual(before);
  expect(new Box3().setFromObject(shownBody).equals(bodyBox)).toBe(true);
  expect(new Box3().setFromObject(shownFace).max.z).toBeCloseTo(-25, 5);
  const floor = display.scene!.children.find(
    (o) => o instanceof Mesh && o.receiveShadow,
  )!;
  expect(floor.position.z).toBeLessThan(
    new Box3().setFromObject(shownFace).min.z,
  );
});
