import { beforeAll, describe, expect, it } from "vitest";
import Module, { type ManifoldToplevel } from "manifold-3d";
import { buildModel } from "../src/core/engine";
import { chooseStyle, newProject } from "../src/core/project";
import { parseProject } from "../src/core/storage";
import { fitAssembly, updateFitParameters } from "../src/core/fit-assembly";
import { costs, stl } from "../src/core/output";
import type { Contours, Model, Project } from "../src/core/types";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
});
const shapes: Contours[] = [
  [
    [
      [0, 0],
      [160, 0],
      [160, 160],
      [0, 160],
    ],
    [
      [50, 50],
      [50, 110],
      [110, 110],
      [110, 50],
    ],
  ],
];
const build = (project: Project) =>
  buildModel(wasm, { project, shapes, mode: "letters" });
const part = (model: Model, layer: string) =>
  model.parts.find((p) => p.layer === layer)!;
const bytes = (model: Model, layer: string, normalize = false) =>
  new Uint8Array(stl([part(model, layer)], normalize));
const depth = (model: Model, layer: string) => {
  const p = part(model, layer);
  return p.bounds.max[2] - p.bounds.min[2];
};

describe.each(["printed-fit", "acrylic-fit"] as const)(
  "Componentes de %s",
  (style) => {
    it("cambia 10 mm de base y conserva cuerpo y acrílico byte a byte", () => {
      const project = chooseStyle(newProject(), style);
      const a = build(project);
      const height = fitAssembly(style, project.params).baseHeight;
      const next = {
        ...project,
        params: updateFitParameters(style, project.params, {
          fitBaseHeight: height - 10,
        }),
      };
      const b = build(next);
      expect(depth(a, "back") - depth(b, "back")).toBeCloseTo(10, 4);
      expect(bytes(a, "body")).toEqual(bytes(b, "body"));
      if (style === "acrylic-fit")
        expect(bytes(a, "face")).toEqual(bytes(b, "face"));
      expect(part(a, "back").id).toBe(part(b, "back").id);
      expect(part(b, "back").name).toContain("Base desmontable");
      expect(costs(next, b).mass).toBeLessThan(costs(project, a).mass);
    });

    it("conserva las dimensiones de base al aumentar el cuerpo y al guardar", () => {
      const project = chooseStyle(newProject(), style);
      const a = build(project);
      const next = {
        ...project,
        params: updateFitParameters(style, project.params, {
          height: project.params.height + 10,
        }),
      };
      const restored = parseProject(JSON.parse(JSON.stringify(next)));
      const b = build(restored);
      expect(depth(b, "body") - depth(a, "body")).toBeCloseTo(10, 4);
      expect(depth(b, "back")).toBeCloseTo(depth(a, "back"), 4);
      expect(part(b, "back").volume).toBeCloseTo(part(a, "back").volume, 3);
      // El montaje traslada la base. Comparar los vértices del STL normalizado
      // permite el redondeo de Float32 al cambiar el origen, sin tolerar cambios físicos.
      const sa = new DataView(stl([part(a, "back")], true));
      const sb = new DataView(stl([part(b, "back")], true));
      expect(sa.getUint32(80, true)).toBe(sb.getUint32(80, true));
      for (let triangle = 0; triangle < sa.getUint32(80, true); triangle++)
        for (let coordinate = 0; coordinate < 9; coordinate++) {
          const offset = 84 + triangle * 50 + 12 + coordinate * 4;
          expect(
            Math.abs(sa.getFloat32(offset, true) - sb.getFloat32(offset, true)),
          ).toBeLessThan(0.00001);
        }
      const switched = chooseStyle(chooseStyle(restored, "organic"), style);
      expect(switched.params.fitBaseHeight).toBe(restored.params.fitBaseHeight);
    });

    it("abre proyectos anteriores con su altura derivada y los edita sin cambiar la forma", () => {
      const project = chooseStyle(newProject(), style);
      project.params.innerReduction = 10;
      project.params.outerRecess = 8;
      const legacy = JSON.parse(JSON.stringify(project));
      delete legacy.params.fitBaseHeight;
      const restored = parseProject(legacy);
      const before = build(restored);
      const explicit = {
        ...restored,
        params: updateFitParameters(style, restored.params, {}),
      };
      const after = build(explicit);
      for (const p of before.parts)
        expect(bytes(after, p.layer)).toEqual(bytes(before, p.layer));
      expect(
        parseProject(JSON.parse(JSON.stringify(explicit))).params.fitBaseHeight,
      ).toBeGreaterThan(0);
    });

    it("rechaza alturas que invaden el frente o no alcanzan para el fondo", () => {
      const project = chooseStyle(newProject(), style);
      for (const fitBaseHeight of [
        project.params.height,
        project.params.traySheet,
      ]) {
        expect(() =>
          build({ ...project, params: { ...project.params, fitBaseHeight } }),
        ).toThrow("base desmontable");
      }
      const recessed = {
        ...project,
        params: { ...project.params, outerRecess: 12, fitBaseHeight: 5 },
      };
      expect(() => build(recessed)).toThrow("base desmontable");
    });
  },
);

it("editar el espesor del acrílico no modifica la base ni el cuerpo", () => {
  const project = chooseStyle(newProject(), "acrylic-fit");
  const before = build(project);
  const next = {
    ...project,
    params: updateFitParameters(project.style, project.params, { acrylic: 4 }),
  };
  const after = build(next);
  expect(bytes(after, "back")).toEqual(bytes(before, "back"));
  expect(bytes(after, "body")).toEqual(bytes(before, "body"));
  expect(depth(after, "face")).toBeCloseTo(4, 4);
});

it("guarda alturas explícitas sin aceptar parámetros de tipo incorrecto", () => {
  const project = chooseStyle(newProject(), "printed-fit");
  const invalid = {
    ...project,
    params: { ...project.params, fitBaseHeight: "20" },
  };
  expect(() => parseProject(invalid)).toThrow("Tipo de parámetro inválido");
});
