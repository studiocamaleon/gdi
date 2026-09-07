import { beforeAll, describe, expect, it, vi } from "vitest";
import Module, { type ManifoldToplevel } from "manifold-3d";
import { readFile } from "node:fs/promises";
import { buildModel } from "../src/core/engine";
import { chooseStyle, newProject } from "../src/core/project";
import {
  fitAssembly,
  FIT_BASES,
  updateFitParameters,
} from "../src/core/fit-assembly";
import { assemblyOffset } from "../src/core/assembly";
import { parseProject } from "../src/core/storage";
import {
  bundle,
  costs,
  placedPart,
  quoteEnvelope,
  stl,
} from "../src/core/output";
import { contoursFromSource } from "../src/core/source";
import type { Contours, FitBaseType, Part, Project } from "../src/core/types";
import { unzipSync } from "fflate";
import { DOMParser } from "linkedom";

let wasm: ManifoldToplevel, R: Contours[];
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
    mode: "text",
    text: "R",
    height: 100,
    spacing: 0,
  });
});
const project = (
  type: FitBaseType,
  style: Project["style"] = "acrylic-fit",
) => {
  const p = chooseStyle(newProject(), style);
  Object.assign(p.params, {
    fitBaseType: type,
    fitBaseHeight: 25,
    fitProfileTop: 5,
    mirror: false,
  });
  return p;
};
const build = (p: Project, shapes = wide) =>
  buildModel(wasm, { project: p, mode: "letters", shapes });
const solid = (p: Part) =>
  new wasm.Manifold(
    new wasm.Mesh({
      numProp: 3,
      vertProperties: p.positions,
      triVerts: p.indices,
    }),
  );
const collision = (a: Part, b: Part, az = 0, bz = 0) => {
  const sa = solid(a),
    sb = solid(b),
    ma = sa.translate([0, 0, az]),
    mb = sb.translate([0, 0, bz]),
    overlap = ma.intersect(mb);
  const v = overlap.volume();
  [sa, sb, ma, mb, overlap].forEach((x) => x.delete());
  return v;
};
function checkStl(p: Part) {
  const bytes = stl([p], true),
    view = new DataView(bytes),
    n = view.getUint32(80, true);
  const verts = new Float32Array(n * 9),
    ids = new Uint32Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 9; j++)
      verts[i * 9 + j] = view.getFloat32(84 + i * 50 + 12 + j * 4, true);
    const o = i * 9,
      u = [0, 1, 2].map((k) => verts[o + 3 + k] - verts[o + k]),
      v = [0, 1, 2].map((k) => verts[o + 6 + k] - verts[o + k]);
    expect(
      Math.hypot(
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ),
    ).toBeGreaterThan(0);
  }
  ids.forEach((_, i) => (ids[i] = i));
  const mesh = new wasm.Mesh({
    numProp: 3,
    vertProperties: verts,
    triVerts: ids,
  });
  mesh.merge();
  const m = new wasm.Manifold(mesh);
  expect(m.status()).toBe("NoError");
  expect(m.volume()).toBeCloseTo(p.volume, 1);
  m.delete();
}

describe.each(["acrylic-fit", "printed-fit"] as const)(
  "Bases de %s",
  (style) => {
    for (const { value: type } of FIT_BASES.filter(
      (b) => b.value !== "legacy",
    )) {
      for (const shape of ["anillo", "R"] as const)
        it(`${type} · ${shape}: sólidos cerrados y montaje completo sin colisiones`, () => {
          const p = project(type, style);
          if (shape === "R")
            Object.assign(p.params, {
              wall: 1.2,
              innerWall: 0.8,
              secondInnerWall: 0.8,
              fitChannelGap: 1,
              fitRingWidth: 1,
              fitLockDepth: 0.8,
            });
          const m = build(p, shape === "R" ? R : wide);
          expect(m.parts.length).toBe(
            (style === "acrylic-fit" ? 3 : 2) + (type === "ring-pvc" ? 1 : 0),
          );
          for (const part of m.parts) {
            checkStl(part);
            checkStl(
              placedPart({
                part,
                x: 11.37,
                y: 19.29,
                width: 160,
                height: 160,
                rotated: true,
                bed: 0,
              }),
            );
            const s = solid(part),
              components = s.decompose();
            // Las paredes alrededor del hueco de una R/anillo son islas físicas
            // separadas del contorno exterior cuando el frente no es impreso.
            const islands =
              (part.layer === "body" && style === "acrylic-fit") ||
              (part.layer === "back" && type === "ring-pvc")
                ? 2
                : 1;
            expect(components.length, part.name).toBe(islands);
            components.forEach((c) => c.delete());
            s.delete();
          }
          for (const distance of [0, 0.2, 2, 10, 25, 46, 60, 100, 150, 300])
            for (let i = 0; i < m.parts.length; i++)
              for (let j = i + 1; j < m.parts.length; j++) {
                const x = m.parts[i],
                  y = m.parts[j];
                expect(
                  collision(
                    x,
                    y,
                    assemblyOffset(p, x.layer, x.assemblyDirection!, distance),
                    assemblyOffset(p, y.layer, y.assemblyDirection!, distance),
                  ),
                  `${x.layer}/${y.layer} · ${distance}`,
                ).toBeLessThan(0.01);
              }
          if (type === "pvc-lock") {
            const pvc = m.parts.find((p) => p.layer === "pvc")!,
              body = m.parts.find((p) => p.layer === "body")!;
            expect(collision(pvc, body, -0.05)).toBeGreaterThan(1);
          }
          if (type === "ring-pvc") {
            const pvc = m.parts.find((p) => p.layer === "pvc")!,
              base = m.parts.find((p) => p.layer === "back")!;
            expect(collision(pvc, base, 0.05)).toBeGreaterThan(1);
          }
        });
    }
    for (const profile of ["bevel", "curved", "angular"] as const)
      for (const direction of ["inward", "outward"] as const)
        it(`traba con perfil ${profile}/${direction}: acrílico y PVC atraviesan todo el paso recto`, () => {
          const p = project("pvc-lock", style);
          Object.assign(p.params, {
            fitWallProfile: profile,
            fitProfileDirection: direction,
            fitProfileTop: 5,
          });
          const m = build(p),
            body = solid(m.parts.find((p) => p.layer === "body")!);
          for (const part of m.parts) {
            checkStl(part);
            if (part.material === "filament") continue;
            const cs = new wasm.CrossSection(part.contours, "EvenOdd"),
              sweep = cs.extrude(100),
              move = sweep.translate([0, 0, part.bounds.min[2] + 0.001]),
              overlap = body.intersect(move);
            expect(overlap.volume(), part.name).toBeLessThan(0.01);
            [cs, sweep, move, overlap].forEach((x) => x.delete());
          }
          body.delete();
        });
  },
);

it("conserva el cuerpo y el acrílico al editar la altura de cada base", () => {
  for (const { value: type } of FIT_BASES.filter(
    (b) => !["legacy", "pvc-lock"].includes(b.value),
  )) {
    const p = project(type),
      a = build(p),
      next = {
        ...p,
        params: updateFitParameters(p.style, p.params, { fitBaseHeight: 30 }),
      },
      b = build(next);
    for (const layer of ["body", "face", "pvc"] as const) {
      const x = a.parts.find((p) => p.layer === layer),
        y = b.parts.find((p) => p.layer === layer);
      if (x && y)
        expect(new Uint8Array(stl([x]))).toEqual(new Uint8Array(stl([y])));
    }
  }
});
it("separa archivos, materiales y consumos del marco, PVC y acrílico", () => {
  const p = project("ring-pvc"),
    m = build(p),
    files = unzipSync(bundle(p, m)),
    quote = quoteEnvelope(p, m);
  expect(Object.keys(files).filter((f) => f.endsWith(".stl"))).toHaveLength(2);
  expect(Object.keys(files)).toContain("corte/pvc/pvc-0-0.dxf");
  expect(Object.keys(files)).toContain("corte/acrylic/face-0-0.dxf");
  expect(quote.version).toBe(2);
  expect(quote.components.filter((c) => c.materialKind === "pvc")).toHaveLength(
    1,
  );
  const estimate = costs(p, m),
    pvc = m.parts.find((p) => p.layer === "pvc")!;
  expect(estimate.pvcArea).toBeCloseTo(pvc.area / 1e6, 8);
  expect(pvc.bounds.max[0] - pvc.bounds.min[0]).toBeCloseTo(
    160 -
      2 *
        (p.params.wall +
          p.params.clearance +
          p.params.innerWall +
          p.params.pvcClearance),
    3,
  );
});
it("guarda las variantes y conserva los proyectos anteriores", () => {
  const p = project("rim");
  const restored = parseProject(JSON.parse(JSON.stringify(p)));
  expect(restored.params.fitBaseType).toBe("rim");
  const legacy = JSON.parse(
    JSON.stringify(chooseStyle(newProject(), "acrylic-fit")),
  );
  for (const key of Object.keys(legacy.params))
    if (key.startsWith("fit") && key !== "fitBaseHeight")
      delete legacy.params[key];
  delete legacy.colors.pvc;
  expect(parseProject(legacy).params.fitBaseType).toBe("legacy");
  expect(parseProject(legacy).colors.pvc).toMatch(/^#/);
  expect(() =>
    parseProject({ ...p, params: { ...p.params, fitBaseType: "unknown" } }),
  ).toThrow("Opción de modelo inválida");
});
it("rechaza piezas sin apoyo, perfiles incompatibles y canales que no caben", () => {
  for (const [type, params] of [
    ["ring-pvc", { pvcClearance: 3 }],
    ["pvc-lock", { fitLockDepth: 0.1 }],
    ["pvc-lock", { pvc: 44 }],
    ["double-channel", { fitChannelGap: 70 }],
    [
      "pvc-lock",
      { fitWallProfile: "curved", fitProfileTop: 40, fitProfileBottom: 10 },
    ],
    ["flush", { fitBaseHeight: 44 }],
  ] as const) {
    const p = project(type);
    Object.assign(p.params, params);
    expect(() => build(p)).toThrow();
  }
});
