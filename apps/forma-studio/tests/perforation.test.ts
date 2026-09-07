import { beforeAll, describe, expect, it } from "vitest";
import Module, { type ManifoldToplevel } from "manifold-3d";
import { unzipSync } from "fflate";
import { buildModel } from "../src/core/engine";
import { chooseStyle, newProject } from "../src/core/project";
import {
  fitAssembly,
  FIT_BASES,
  updateFitParameters,
} from "../src/core/fit-assembly";
import { assemblyOffset, frontDirection } from "../src/core/assembly";
import { parseProject } from "../src/core/storage";
import { bundle, costs, quoteEnvelope, stl } from "../src/core/output";
import {
  createPerforation,
  patternShape,
  patternPitch,
  PATTERNS,
} from "../src/core/perforation";
import type { Contours, Part, Project } from "../src/core/types";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await Module();
  wasm.setup();
});
const shapes: Contours[] = [
  [
    [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    [
      [35, 35],
      [35, 65],
      [65, 65],
      [65, 35],
    ],
  ],
];
const project = () => {
  const p = chooseStyle(newProject(), "perforated");
  Object.assign(p.params, {
    mirror: false,
    patternSize: 6,
    patternLength: 10,
    patternSpacing: 3,
  });
  return p;
};
const build = (p: Project) =>
  buildModel(wasm, { project: p, shapes, mode: "letters" });
const solid = (p: Part) =>
  new wasm.Manifold(
    new wasm.Mesh({
      numProp: 3,
      vertProperties: p.positions,
      triVerts: p.indices,
    }),
  );
function checkMesh(part: Part) {
  const b = new DataView(stl([part], true)),
    n = b.getUint32(80, true),
    v = new Float32Array(n * 9),
    ids = new Uint32Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 9; j++)
      v[i * 9 + j] = b.getFloat32(84 + i * 50 + 12 + j * 4, true);
    const o = i * 9,
      u = [0, 1, 2].map((k) => v[o + 3 + k] - v[o + k]),
      w = [0, 1, 2].map((k) => v[o + 6 + k] - v[o + k]);
    expect(
      Math.hypot(
        u[1] * w[2] - u[2] * w[1],
        u[2] * w[0] - u[0] * w[2],
        u[0] * w[1] - u[1] * w[0],
      ),
    ).toBeGreaterThan(0);
  }
  ids.forEach((_, i) => (ids[i] = i));
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties: v, triVerts: ids });
  mesh.merge();
  const m = new wasm.Manifold(mesh);
  expect(m.status()).toBe("NoError");
  expect(m.volume()).toBeCloseTo(part.volume, 1);
  m.delete();
}
function checkTravel(p: Project, parts: Part[]) {
  const body = solid(parts.find((p) => p.layer === "body")!);
  for (const part of parts.filter((p) => p.material !== "filament")) {
    const profile = new wasm.CrossSection(part.contours, "EvenOdd"),
      sweep = profile.extrude(100),
      moved = sweep.translate([0, 0, part.bounds.min[2] + 0.001]),
      overlap = body.intersect(moved);
    expect(overlap.volume(), part.name).toBeLessThan(0.01);
    [profile, sweep, moved, overlap].forEach((x) => x.delete());
  }
  body.delete();
  const solids = parts.map(solid);
  for (const distance of [0, 0.2, 5, 20, 41, 60, 100, 150]) {
    const moved = solids.map((s, i) =>
      s.translate([
        0,
        0,
        assemblyOffset(
          p,
          parts[i].layer,
          parts[i].assemblyDirection!,
          distance,
        ),
      ]),
    );
    for (let i = 0; i < moved.length; i++)
      for (let j = i + 1; j < moved.length; j++) {
        const overlap = moved[i].intersect(moved[j]);
        expect(overlap.volume()).toBeLessThan(0.01);
        overlap.delete();
      }
    moved.forEach((s) => s.delete());
  }
  solids.forEach((s) => s.delete());
}
describe("Frente calado con difusor", () => {
  for (const { value: type } of PATTERNS)
    it(`${type}: calados pasantes, bordes protegidos, difusor entero y STL cerrado`, () => {
      const p = project();
      p.params.patternType = type;
      const m = build(p),
        body = solid(m.parts.find((p) => p.layer === "body")!),
        face = m.parts.find((p) => p.layer === "face")!;
      const outline = new wasm.CrossSection(shapes[0], "EvenOdd"),
        safe = outline.offset(-p.params.patternBorder, "Miter", 2, 48),
        front = body.slice(p.params.base / 2),
        holes = outline.subtract(front),
        outside = holes.subtract(safe);
      expect(m.perforation!.holes).toBeGreaterThan(20);
      expect(outside.area()).toBeLessThan(0.02);
      expect(holes.area()).toBeCloseTo(m.perforation!.openArea, 0);
      // Un hueco en el frente sigue vacío hasta atravesar su espesor completo.
      const cast = holes.extrude(p.params.base - 0.02),
        move = cast.translate([0, 0, 0.01]),
        blocked = body.intersect(move);
      expect(blocked.volume()).toBeLessThan(0.05);
      const diffuser = new wasm.CrossSection(face.contours, "EvenOdd"),
        uncovered = holes.subtract(diffuser);
      expect(uncovered.area()).toBeLessThan(0.01);
      expect(diffuser.toPolygons()).toHaveLength(2); // Sólo el hueco tipográfico.
      expect(face.material).toBe("acrylic");
      expect(face.name).toContain("Difusor");
      expect(face.bounds.min[2]).toBeCloseTo(p.params.base, 4);
      const islands = body.decompose();
      expect(islands).toHaveLength(1);
      islands.forEach((s) => s.delete());
      [
        body,
        outline,
        safe,
        front,
        holes,
        outside,
        cast,
        move,
        blocked,
        diffuser,
        uncovered,
      ].forEach((x) => x.delete());
      m.parts.forEach(checkMesh);
      checkTravel(p, m.parts);
    });
  for (const { value: type } of FIT_BASES.filter((b) => b.value !== "legacy"))
    it(`se monta y exporta con base ${type}`, () => {
      const p = project();
      p.params.fitBaseType = type;
      const m = build(p);
      m.parts.forEach(checkMesh);
      checkTravel(p, m.parts);
      expect(frontDirection(p)).toBe(-1);
      expect(m.parts.length).toBe(type === "ring-pvc" ? 4 : 3);
      const files = unzipSync(bundle(p, m));
      expect(Object.keys(files)).toContain("corte/acrylic/face-0-0.dxf");
      expect(Object.keys(files)).not.toContain("impresion/face-0-0.stl");
    });
  for (const profile of ["bevel", "curved", "angular"] as const)
    for (const direction of ["inward", "outward"] as const)
      it(`traba ${profile}/${direction}: todos los calados tienen difusor y entrada libre`, () => {
        const p = project();
        Object.assign(p.params, {
          fitBaseType: "pvc-lock",
          fitWallProfile: profile,
          fitProfileDirection: direction,
          patternType: "hexagon",
          patternAngle: 30,
          patternRotation: 15,
        });
        const m = build(p);
        checkTravel(p, m.parts);
        m.parts.forEach(checkMesh);
        const body = solid(m.parts.find((p) => p.layer === "body")!),
          outline = new wasm.CrossSection(shapes[0], "EvenOdd"),
          slice = body.slice(p.params.base / 2),
          holes = outline.subtract(slice),
          plate = new wasm.CrossSection(
            m.parts.find((p) => p.layer === "face")!.contours,
            "EvenOdd",
          ),
          outside = holes.subtract(plate);
        expect(outside.area()).toBeLessThan(0.03);
        [body, outline, slice, holes, plate, outside].forEach((x) =>
          x.delete(),
        );
      });
});

it("conserva base y difusor al editar el patrón y descuenta sólo el filamento retirado", () => {
  const p = project(),
    a = build(p),
    b = build({
      ...p,
      params: { ...p.params, patternSize: 8, patternType: "hexagon" },
    });
  for (const layer of ["face", "back"] as const)
    expect(
      new Uint8Array(stl([a.parts.find((p) => p.layer === layer)!])),
    ).toEqual(new Uint8Array(stl([b.parts.find((p) => p.layer === layer)!])));
  expect(costs(p, a).acrylicArea).toBe(costs(p, b).acrylicArea);
  const av = a.parts.find((p) => p.layer === "body")!.volume,
    bv = b.parts.find((p) => p.layer === "body")!.volume;
  expect(av - bv).toBeCloseTo(
    (b.perforation!.openArea - a.perforation!.openArea) * p.params.base,
    0,
  );
  const quote = quoteEnvelope(p, a);
  expect(quote.version).toBe(2);
  expect(quote.design.perforation!.holes).toBe(a.perforation!.holes);
});
it("conserva la altura de base al cambiar el espesor del difusor", () => {
  const p = project(),
    a = build(p),
    updated = {
      ...p,
      params: updateFitParameters(p.style, p.params, { acrylic: 3 }),
    },
    b = build(updated);
  expect(fitAssembly(p.style, updated.params).front).toBe(p.params.base + 3);
  expect(
    new Uint8Array(stl([a.parts.find((p) => p.layer === "back")!])),
  ).toEqual(new Uint8Array(stl([b.parts.find((p) => p.layer === "back")!])));
});
it("las rotaciones son independientes y mantienen separación mínima entre figuras completas", () => {
  const p = project().params;
  Object.assign(p, {
    patternType: "square",
    patternRotation: 37,
    patternAngle: 23,
    patternSize: 6,
    patternSpacing: 1.5,
  });
  const objects: { delete(): void }[] = [],
    keep = <T extends { delete(): void }>(v: T) => {
      objects.push(v);
      return v;
    };
  const outline = keep(new wasm.CrossSection(shapes[0], "EvenOdd")),
    plate = keep(outline.offset(-2.2, "Miter", 2, 48)),
    result = createPerforation(wasm, keep, outline, plate, p);
  const holes = result.holes.decompose();
  expect(holes.length).toBe(result.count);
  const expanded = holes.map((h) =>
      h.offset(p.patternSpacing / 2 - 0.002, "Round", 2, 24),
    ),
    union = wasm.CrossSection.union(expanded);
  expect(union.area()).toBeCloseTo(
    expanded.reduce((sum, h) => sum + h.area(), 0),
    2,
  );
  [...holes, ...expanded, union, ...objects].forEach((h) => h.delete());
  expect(patternPitch({ ...p, patternAngle: 0 }).x).toBe(7.5);
  expect(patternPitch({ ...p, patternAngle: 45 }).x).toBeCloseTo(
    6 * Math.sqrt(2) + 1.5,
    5,
  );
});
it("el margen adicional sólo elimina huecos cercanos al borde", () => {
  const p = project(),
    a = build(p),
    b = build({ ...p, params: { ...p.params, patternMargin: 4 } });
  expect(b.perforation!.holes).toBeLessThan(a.perforation!.holes);
  const x = solid(a.parts.find((p) => p.layer === "body")!),
    y = solid(b.parts.find((p) => p.layer === "body")!),
    outside = x.subtract(y);
  expect(outside.volume()).toBeLessThan(0.01);
  [x, y, outside].forEach((s) => s.delete());
});
it("guarda el modelo y sus patrones sin modificar los estilos anteriores", () => {
  const p = project();
  p.params.patternType = "triangle";
  p.params.patternRotation = 32;
  const restored = parseProject(
    JSON.parse(
      JSON.stringify(chooseStyle(chooseStyle(p, "organic"), "perforated")),
    ),
  );
  expect(restored.params.patternType).toBe("triangle");
  expect(restored.params.patternRotation).toBe(32);
  const legacy = JSON.parse(
    JSON.stringify(chooseStyle(newProject(), "printed-fit")),
  );
  for (const key of Object.keys(legacy.params))
    if (key.startsWith("pattern")) delete legacy.params[key];
  expect(parseProject(legacy).style).toBe("printed-fit");
  expect(() =>
    parseProject({ ...p, params: { ...p.params, patternType: "invalid" } }),
  ).toThrow("Opción de modelo inválida");
});
it("rechaza calados sin espacio, frágiles o demasiado densos antes de bloquear el editor", () => {
  for (const changes of [
    { patternSize: 100 },
    { patternSpacing: 0.1 },
    { patternBorder: 1 },
    { patternType: "oblong", patternSize: 8, patternLength: 4 },
    { patternSize: 0.4, patternSpacing: 0.4 },
  ]) {
    const p = project();
    Object.assign(p.params, changes);
    expect(() => build(p)).toThrow();
  }
  const p = project();
  p.params.acrylic = 30;
  expect(() => build(p)).toThrow("base desmontable");
});
it("los seis contornos tienen dimensiones y áreas distintas según su definición", () => {
  const p = project().params;
  const area = (type: typeof p.patternType) => {
    const s = new wasm.CrossSection([
        patternShape({ ...p, patternType: type, patternAngle: 0 }),
      ]),
      a = s.area();
    s.delete();
    return a;
  };
  expect(area("square")).toBeCloseTo(36, 5);
  expect(area("diamond")).toBeCloseTo(18, 5);
  expect(area("hexagon")).toBeCloseTo((27 * Math.sqrt(3)) / 2, 4);
  expect(area("triangle")).toBeCloseTo(9 * Math.sqrt(3), 4);
  expect(area("circle") / (9 * Math.PI)).toBeCloseTo(1, 2);
  expect(area("oblong")).toBeGreaterThan(area("circle"));
});
