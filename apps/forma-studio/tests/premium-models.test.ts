import { afterEach, beforeAll, it, expect, describe, vi } from "vitest";
import Module, { type ManifoldToplevel } from "manifold-3d";
import { DOMParser } from "linkedom";
import { readFile } from "node:fs/promises";
import { buildModel } from "../src/core/engine";
import {
  chooseStyle,
  newProject,
  STYLES,
  styleDefaults,
} from "../src/core/project";
import { contoursFromSource } from "../src/core/source";
import { parseProject } from "../src/core/storage";
import { costs, bundle, stl } from "../src/core/output";
import { unzipSync } from "fflate";
import type {
  Contours,
  Model,
  Part,
  Parameters,
  StyleId,
} from "../src/core/types";
let wasm: ManifoldToplevel, R: Contours[];
// Los cálculos WASM son sincrónicos. Dar lugar a que Vitest reciba las
// confirmaciones de sus reportes entre sólidos evita agotar el timeout RPC.
afterEach(() => new Promise<void>((resolve) => setImmediate(resolve)));
const wide: Contours[] = [
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
beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
  vi.stubGlobal("DOMParser", DOMParser);
  vi.stubGlobal(
    "XMLSerializer",
    class {
      serializeToString(doc: Document) {
        return doc.toString();
      }
    },
  );
  const font = await readFile(
    new URL("../public/fonts/BebasNeue.ttf", import.meta.url),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () =>
        font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength),
    })),
  );
  R = await contoursFromSource({
    ...newProject().source,
    text: "R",
    height: 100,
    spacing: 0,
  });
});
function model(style: StyleId, params: Partial<Parameters> = {}, shapes = R) {
  const project = chooseStyle(newProject(), style);
  Object.assign(project.params, params);
  return buildModel(wasm, { project, shapes, mode: "letters" });
}
function solid(part: Part) {
  return new wasm.Manifold(
    new wasm.Mesh({
      numProp: 3,
      vertProperties: part.positions,
      triVerts: part.indices,
    }),
  );
}
function section(m: Model, z: number) {
  const s = solid(m.parts.find((p) => p.layer === "body")!),
    c = s.slice(z),
    area = c.area();
  c.delete();
  s.delete();
  return area;
}
function separated(m: Model) {
  const ss = m.parts.map(solid);
  try {
    for (let i = 0; i < ss.length; i++) {
      expect(ss[i].status()).toBe("NoError");
      for (let j = i + 1; j < ss.length; j++) {
        const x = ss[i].intersect(ss[j]);
        expect(
          x.volume(),
          `${m.parts[i].layer}/${m.parts[j].layer}`,
        ).toBeLessThan(0.1);
        x.delete();
      }
    }
  } finally {
    ss.forEach((s) => s.delete());
  }
}
describe("Medidas observadas en la referencia Maker", () => {
  it("reproduce las dos paredes continuas y el asiento del frente", () => {
    const a = model("solid-back");
    expect(a.depth).toBeCloseTo(37, 3);
    expect(section(a, 1)).toBeCloseTo(3440.986, 0);
    expect(section(a, 20)).toBeCloseTo(1819.206, 0);
    expect(section(a, 35)).toBeCloseTo(910.917, 0);
    const b = model("open-back");
    expect(b.depth).toBeCloseTo(35, 3);
    // El saneamiento a 1 µm puede cambiar el área de sección unos milésimos de mm².
    expect(section(b, 20)).toBeCloseTo(section(a, 20), 2);
    expect(section(model("open-back", { innerWall: 0 }), 20)).toBeCloseTo(
      910.917,
      0,
    );
  });
  it("conserva alturas y espesores de las tapas encastrables", () => {
    for (const [style, height] of [
      ["acrylic-fit", 20.8],
      ["printed-fit", 22.8],
    ] as const) {
      const m = model(style);
      const back = m.parts.find((p) => p.layer === "back")!;
      expect(back.bounds.max[2] - back.bounds.min[2]).toBeCloseTo(height, 3);
      expect(back.printFlip).toBe(true);
      separated(m);
    }
  });
  it("el apoyo inclinado aparece en su cota y no invade las placas", () => {
    const m = model("double-support");
    expect(m.depth).toBeCloseTo(45, 3);
    expect(section(m, 2)).toBeCloseTo(910.917, 0);
    expect(section(m, 3.57735)).toBeGreaterThan(section(m, 3.01) + 300);
    expect(section(m, 4.2)).toBeCloseTo(section(m, 2), 2);
    separated(m);
  });
  it("el barrido angular sigue el radio y la altura originales", () => {
    const m = model("curved");
    expect(m.width).toBeCloseTo(88.4286, 2);
    expect(m.height).toBeCloseTo(205, 2);
    expect(m.depth).toBeCloseTo(252.487, 2);
    const noBase = model("curved", { curveBase: false });
    expect(noBase.depth).toBeCloseTo(242.487, 2);
  });
  it("la traba de neón estrecha el canal sólo a su altura", () => {
    const m = model("neon");
    expect(m.parts).toHaveLength(1);
    expect(m.depth).toBeCloseTo(8.2, 4);
    expect(section(m, 6.2)).toBeGreaterThan(section(m, 5.4) + 250);
    expect(section(m, 7)).toBeCloseTo(section(m, 5.4), 1);
  });
});
describe("Variantes y producción", () => {
  for (const id of STYLES.map((s) => s.id))
    it(`mantiene piezas disjuntas en la letra R: ${id}`, () =>
      separated(model(id)));
  for (const profile of [
    "zigzag",
    "belly",
    "pedestal",
    "waves",
    "bumper",
    "bubble",
    "stack",
  ] as const)
    it(`genera el perfil ${profile} y cambia su sección con Z`, () => {
      const m = model("organic", { organicProfile: profile });
      expect(m.parts.length).toBe(2);
      separated(m);
      const z = m.parts[0].bounds.max[2],
        areas = [0.13, 0.37, 0.63, 0.87, 0.95].map((t) => section(m, z * t));
      expect(Math.max(...areas) - Math.min(...areas)).toBeGreaterThan(1);
    });
  it("genera bandeja con holgura, curvas desmontables y canales de contorno", () => {
    separated(
      model(
        "halo",
        { doubleHalo: true, wall: 3, innerWall: 3, backTray: true },
        wide,
      ),
    );
    separated(model("curved", { curveSeparate: true }));
    separated(model("neon", { neonOutline: true, neonWidth: 10 }, wide));
  });
  it("conserva siete perfiles macizos y las combinaciones de frente y fondo", () => {
    for (const organicProfile of [
      "zigzag",
      "belly",
      "pedestal",
      "waves",
      "bumper",
      "bubble",
      "stack",
    ] as const)
      expect(
        model("organic", { organicProfile, organicSolid: true }, wide).parts,
      ).toHaveLength(1);
    for (const organicFace of ["acrylic", "printed"] as const)
      for (const organicBack of ["printed", "pvc"] as const)
        for (const organicFit of ["front", "back"] as const)
          separated(
            model(
              "organic",
              { organicFace, organicBack, organicFit, organicShell: true },
              wide,
            ),
          );
  });
  it("separa materiales de corte y calcula PVC sin imputarlo como acrílico", () => {
    const project = chooseStyle(newProject(), "double-support"),
      m = model("double-support");
    const c = costs(project, m);
    expect(c.pvcArea).toBeGreaterThan(0);
    expect(c.pvc).toBeCloseTo(c.pvcArea * 1.1 * project.production.pvcM2, 6);
    const names = Object.keys(unzipSync(bundle(project, m)));
    expect(
      names.some((n) => n.startsWith("corte/pvc/") && n.endsWith(".dxf")),
    ).toBe(true);
    expect(
      Object.keys(
        unzipSync(
          bundle(chooseStyle(newProject(), "solid-back"), model("solid-back")),
        ),
      ).some((n) => n.includes("base-led")),
    ).toBe(true);
  });
  it("migra parámetros, permite barriga negativa y conserva defaults al cambiar de estilo", () => {
    const p = chooseStyle(newProject(), "organic");
    p.params.organicBelly = -5;
    expect(parseProject(p).params.organicBelly).toBe(-5);
    expect(
      chooseStyle(chooseStyle(p, "printed-fit"), "organic").params.organicBelly,
    ).toBe(-5);
    expect(chooseStyle(p, "printed-fit").params).toEqual(
      styleDefaults("printed-fit"),
    );
    const legacy = JSON.parse(JSON.stringify(p));
    delete legacy.params.organicWavePeriod;
    delete legacy.production.pvcM2;
    expect(parseProject(legacy).params.organicWavePeriod).toBe(8);
  });
});
it("apoyo plano, pestaña y retroceso respetan sus cotas y placas", () => {
  const flat = model("double-support", { flatSupport: true, lipEnabled: true });
  separated(flat);
  expect(section(flat, 41.3)).toBeCloseTo(910.917, 0);
  expect(section(flat, 41.9)).toBeGreaterThan(1250);
  const recess = model("acrylic-fit", { outerRecess: 8, innerReduction: 10 });
  separated(recess);
  expect(recess.parts[0].bounds.max[2]).toBeCloseTo(37, 4);
  const back = recess.parts.find((p) => p.layer === "back")!;
  expect(back.bounds.max[0] - back.bounds.min[0]).toBeCloseTo(48.4286, 2);
  const organic = model("organic", { organicFit: "back" });
  separated(organic);
  expect(organic.depth).toBeCloseTo(39.7, 3);
  expect(organic.parts).toHaveLength(3);
});
