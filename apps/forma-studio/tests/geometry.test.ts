import { beforeAll, describe, it, expect } from "vitest";
import Module, { type ManifoldToplevel } from "manifold-3d";
import { buildModel } from "../src/core/engine";
import { newProject, STYLES, chooseStyle } from "../src/core/project";
import { stl, packParts, quoteEnvelope } from "../src/core/output";
import { parseProject } from "../src/core/storage";
import type { Contours } from "../src/core/types";
let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
});
const outlines: Contours[] = [
  [
    [
      [0, 0],
      [100, 0],
      [100, 80],
      [0, 80],
    ],
    [
      [30, 25],
      [30, 55],
      [70, 55],
      [70, 25],
    ],
  ],
];
describe("Sólidos fabricables", () => {
  for (const style of STYLES)
    it(`genera ${style.name} con agujeros conservados`, () => {
      const project = chooseStyle(newProject(), style.id);
      const model = buildModel(wasm, {
        project,
        shapes: outlines,
        mode: "letters",
      });
      expect(model.parts.length).toBeGreaterThan(0);
      for (const part of model.parts) {
        expect(part.volume).toBeGreaterThan(0);
        expect(part.positions.every(Number.isFinite)).toBe(true);
        const mesh = new wasm.Mesh({
          numProp: 3,
          vertProperties: part.positions,
          triVerts: part.indices,
        });
        const solid = new wasm.Manifold(mesh);
        expect(solid.status()).toBe("NoError");
        expect(solid.volume()).toBeCloseTo(part.volume, 1);
        solid.delete();
      }
      const expected: Record<string, [number, number]> = {
        curved: [140, 185],
        neon: [102.4, 82.4],
        organic: [106, 86],
      };
      expect(model.width).toBeCloseTo(expected[style.id]?.[0] ?? 100, 1);
      expect(model.height).toBeCloseTo(expected[style.id]?.[1] ?? 80, 1);
    });
  it("el corte cierra las dos mitades y conserva el volumen sin separación", () => {
    const p = newProject(),
      before = buildModel(wasm, {
        project: p,
        shapes: outlines,
        mode: "letters",
      });
    p.cuts = [{ id: "x", axis: "x", at: 50, gap: 0 }];
    const after = buildModel(wasm, {
      project: p,
      shapes: outlines,
      mode: "letters",
    });
    const vol = (m: typeof before) => m.parts.reduce((s, p) => s + p.volume, 0);
    expect(vol(after)).toBeCloseTo(vol(before), 2);
    expect(after.parts.length).toBe(before.parts.length * 2);
  });
  it("una perforación resta el volumen del agujero en la base", () => {
    const p = newProject(),
      before = buildModel(wasm, {
        project: p,
        shapes: outlines,
        mode: "letters",
      });
    p.features = [
      {
        id: "h",
        type: "hole",
        x: 15,
        y: 15,
        diameter: 4,
        width: 4,
        height: 4,
        radius: 2,
        shape: "circle",
      },
    ];
    const after = buildModel(wasm, {
      project: p,
      shapes: outlines,
      mode: "letters",
    });
    expect(before.parts[0].volume - after.parts[0].volume).toBeCloseTo(
      Math.PI * 4 * p.params.base,
      0,
    );
  });
  it("exporta STL en milímetros con normales válidas y sin caras degeneradas", () => {
    const m = buildModel(wasm, {
        project: newProject(),
        shapes: outlines,
        mode: "letters",
      }),
      data = stl(m.parts),
      count = m.parts.reduce((s, p) => s + p.indices.length / 3, 0);
    const view = new DataView(data),
      exported = view.getUint32(80, true);
    expect(exported).toBeGreaterThan(0);
    expect(exported).toBeLessThanOrEqual(count);
    expect(data.byteLength).toBe(84 + exported * 50);
    for (let i = 0; i < exported; i++)
      expect(
        Math.hypot(
          ...[0, 4, 8].map((offset) =>
            view.getFloat32(84 + i * 50 + offset, true),
          ),
        ),
      ).toBeCloseTo(1, 5);
  });
  it("rechaza valores no finitos y parámetros negativos", () => {
    const p = newProject();
    p.source.height = Infinity;
    expect(() => parseProject(p)).toThrow();
    p.source.height = 100;
    p.params.wall = -5;
    expect(() => parseProject(p)).toThrow();
  });
  it("incluye áreas y volumen en el contrato de cotización", () => {
    const p = newProject(),
      m = buildModel(wasm, { project: p, shapes: outlines, mode: "letters" }),
      q = quoteEnvelope(p, m);
    expect(q.units).toBe("mm");
    expect(q.components[0].volumeMm3).toBe(m.parts[0].volume);
    expect(q.components[0].cutAreaMm2).toBeGreaterThan(0);
  });
  it("organiza piezas dentro de la mesa sin superposición", () => {
    const p = newProject(),
      m = buildModel(wasm, { project: p, shapes: outlines, mode: "letters" }),
      layout = packParts(m.parts, p);
    for (const a of layout.placements) {
      expect(a.x + a.width).toBeLessThanOrEqual(p.production.bedWidth + 0.01);
      expect(a.y + a.height).toBeLessThanOrEqual(p.production.bedHeight + 0.01);
      for (const b of layout.placements)
        if (a !== b && a.bed === b.bed)
          expect(
            a.x + a.width <= b.x ||
              b.x + b.width <= a.x ||
              a.y + a.height <= b.y ||
              b.y + b.height <= a.y,
          ).toBe(true);
    }
  });
  it("produce las dos piezas del encastre esférico", () => {
    const m = buildModel(wasm, {
      project: newProject(),
      shapes: [],
      mode: "joint",
    });
    expect(m.parts.map((p) => p.layer)).toEqual(["pin", "socket"]);
    for (const p of m.parts) expect(p.volume).toBeGreaterThan(10);
  });
});

it("las caras y sus apoyos no ocupan el mismo volumen", () => {
  for (const style of STYLES) {
    const project = chooseStyle(newProject(), style.id),
      model = buildModel(wasm, { project, shapes: outlines, mode: "letters" });
    const solids = model.parts.map(
      (part) =>
        new wasm.Manifold(
          new wasm.Mesh({
            numProp: 3,
            vertProperties: part.positions,
            triVerts: part.indices,
          }),
        ),
    );
    try {
      for (let i = 0; i < solids.length; i++)
        for (let j = i + 1; j < solids.length; j++) {
          const intersection = solids[i].intersect(solids[j]);
          try {
            expect(
              intersection.volume(),
              `${style.id}: ${model.parts[i].layer}/${model.parts[j].layer}`,
            ).toBeLessThan(0.1);
          } finally {
            intersection.delete();
          }
        }
    } finally {
      solids.forEach((s) => s.delete());
    }
  }
});
