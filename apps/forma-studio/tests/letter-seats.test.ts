import { beforeAll, describe, expect, it } from "vitest";
import Module, { type ManifoldToplevel } from "manifold-3d";
import { buildModel } from "../src/core/engine";
import { chooseStyle, newProject, STYLES } from "../src/core/project";
import type { Contours, Model, Part } from "../src/core/types";

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
const profiles = [
  "zigzag",
  "belly",
  "pedestal",
  "waves",
  "bumper",
  "bubble",
  "stack",
] as const;
function solid(part: Part) {
  return new wasm.Manifold(
    new wasm.Mesh({
      numProp: 3,
      vertProperties: part.positions,
      triVerts: part.indices,
    }),
  );
}
// Cortes horizontales a través de paredes exteriores y del hueco tipográfico.
// Comprobar el alojamiento, además del paso de una placa más pequeña, detecta
// las zonas ensanchadas que las pruebas de colisión solas no advertían.
function crossings(polygons: Contours, y: number) {
  const xs: number[] = [];
  for (const loop of polygons)
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i],
        b = loop[(i + 1) % loop.length];
      if (a[1] < y !== b[1] < y)
        xs.push(a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]));
    }
  return xs.sort((a, b) => a - b);
}
function expectGuide(part: Part, min: number, max: number, inset: number) {
  const body = solid(part);
  try {
    for (const t of [0.02, 0.15, 0.4, 0.7, 0.98]) {
      const section = body.slice(min + (max - min) * t);
      try {
        const acrossWall = crossings(section.toPolygons(), 20);
        expect(acrossWall).toHaveLength(4);
        expect(acrossWall[1]).toBeCloseTo(inset, 2);
        expect(acrossWall[2]).toBeCloseTo(160 - inset, 2);
        const acrossHole = crossings(section.toPolygons(), 80);
        expect(acrossHole).toHaveLength(8);
        expect(acrossHole[2]).toBeCloseTo(50 - inset, 2);
        expect(acrossHole[5]).toBeCloseTo(110 + inset, 2);
      } finally {
        section.delete();
      }
    }
  } finally {
    body.delete();
  }
}

function expectPlateTravel(model: Model) {
  const bodies = model.parts.filter((p) => p.layer === "body").map(solid);
  try {
    for (const part of model.parts.filter((p) => p.material !== "filament")) {
      const direction = part.assemblyDirection!;
      const profile = new wasm.CrossSection(part.contours);
      const extrusion = profile.extrude(
        part.bounds.max[2] - part.bounds.min[2] + model.depth + 10,
      );
      const swept = extrusion.translate([
        0,
        0,
        part.bounds.min[2] - (direction < 0 ? model.depth + 10 : 0),
      ]);
      try {
        for (const body of bodies) {
          const obstruction = swept.intersect(body);
          try {
            expect(obstruction.volume(), part.name).toBeLessThan(0.02);
          } finally {
            obstruction.delete();
          }
        }
      } finally {
        swept.delete();
        extrusion.delete();
        profile.delete();
      }
    }
  } finally {
    bodies.forEach((b) => b.delete());
  }
}

describe("Alojamientos rectos de placas", () => {
  for (const organicProfile of profiles)
    it(`guía frontal constante en ${organicProfile}`, () => {
      const project = chooseStyle(newProject(), "organic");
      project.params.organicProfile = organicProfile;
      const model = buildModel(wasm, { project, shapes, mode: "letters" });
      expectPlateTravel(model);
      const body = model.parts.find((p) => p.layer === "body")!,
        face = model.parts.find((p) => p.layer === "face")!;
      // Medidas obtenidas de las secciones STL de la referencia: con pared de
      // 2 mm, Bubble/Stack alojan a 1,2 mm y los otros perfiles a 2 mm.
      expectGuide(
        body,
        face.bounds.min[2],
        body.bounds.max[2],
        ["bubble", "stack"].includes(organicProfile) ? 1.2 : 2,
      );
    });

  for (const organicProfile of profiles)
    for (const organicBack of ["printed", "pvc"] as const)
      it(`guías frontal y trasera constantes en ${organicProfile} con ${organicBack}`, () => {
        const project = chooseStyle(newProject(), "organic");
        Object.assign(project.params, {
          organicProfile,
          organicFit: "back",
          organicBack,
        });
        const model = buildModel(wasm, { project, shapes, mode: "letters" });
        expectPlateTravel(model);
        const body = model.parts.find((p) => p.layer === "body")!,
          back = model.parts.find((p) => p.layer === "back")!;
        expectGuide(body, back.bounds.min[2], back.bounds.max[2], 2);
        const face = model.parts.find((p) => p.layer === "face")!;
        expectGuide(
          body,
          face.bounds.min[2],
          face.bounds.max[2],
          face.bounds.min[0] - project.params.clearance,
        );
      });

  for (const organicProfile of profiles)
    it(`guía del PVC delantero constante en ${organicProfile}`, () => {
      const project = chooseStyle(newProject(), "organic");
      Object.assign(project.params, { organicProfile, organicBack: "pvc" });
      const model = buildModel(wasm, { project, shapes, mode: "letters" });
      expectPlateTravel(model);
      const body = model.parts.find((p) => p.layer === "body")!,
        back = model.parts.find((p) => p.layer === "back")!;
      // La placa define la holgura; su perímetro no debe ensancharse ni estrecharse con Z.
      expectGuide(
        body,
        back.bounds.min[2],
        back.bounds.max[2],
        back.bounds.min[0] - project.params.pvcClearance,
      );
    });
});

it.each([
  "solid-back",
  "open-back",
  "double-support",
  "single-support",
  "back-fit",
  "acrylic-fit",
  "double-led",
] as const)("guía constante del acrílico en %s", (style) => {
  const project = chooseStyle(newProject(), style);
  const model = buildModel(wasm, { project, shapes, mode: "letters" });
  const body = model.parts.find((p) => p.layer === "body")!,
    face = model.parts.find((p) => p.layer === "face")!;
  expectGuide(
    body,
    face.bounds.min[2],
    face.bounds.max[2],
    project.params.wall + (style === "back-fit" ? project.params.innerWall : 0),
  );
});

it.each(["bubble", "stack"] as const)(
  "%s conserva la meseta de apoyo medida en Letramaker",
  (organicProfile) => {
    const project = chooseStyle(newProject(), "organic");
    project.params.organicProfile = organicProfile;
    const model = buildModel(wasm, { project, shapes, mode: "letters" });
    const body = model.parts.find((p) => p.layer === "body")!,
      face = model.parts.find((p) => p.layer === "face")!;
    expectGuide(body, face.bounds.min[2] - 2, face.bounds.min[2], 2.2);
    // Contacto de toda la banda de apoyo del anillo, no sólo algunos puntos
    // que podrían dejar la placa flotando o apoyada sobre una pared inclinada.
    const s = solid(body),
      probe = solid(face),
      moved = probe.translate([0, 0, -0.05]);
    const deeper = probe.translate([0, 0, -0.1]);
    const contact = moved.intersect(s),
      deeperContact = deeper.intersect(s);
    try {
      // Perímetro conjunto 880 mm × ancho efectivo de apoyo (1 − 0,15).
      // Dos profundidades comprueban toda la banda, independientemente del
      // margen axial de 0,005 mm que evita caras coplanares en el booleano.
      const area = (deeperContact.volume() - contact.volume()) / 0.05;
      expect(area).toBeCloseTo(748, 1);
      expect(0.05 - contact.volume() / area).toBeGreaterThanOrEqual(-0.001);
      expect(0.05 - contact.volume() / area).toBeLessThan(0.006);
    } finally {
      deeperContact.delete();
      contact.delete();
      deeper.delete();
      moved.delete();
      probe.delete();
      s.delete();
    }
  },
);

for (const style of STYLES.map((s) => s.id))
  it(`paso continuo de las placas de corte en ${style}`, () => {
    const project = chooseStyle(newProject(), style);
    const model = buildModel(wasm, { project, shapes, mode: "letters" });
    expectPlateTravel(model);
  });
