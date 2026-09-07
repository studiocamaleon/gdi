import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Module, { type ManifoldToplevel } from "manifold-3d";
import { DOMParser } from "linkedom";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { buildModel } from "../src/core/engine";
import { chooseStyle, newProject, STYLES } from "../src/core/project";
import { contoursFromSource } from "../src/core/source";
import { bundle, placedPart, stl } from "../src/core/output";
import type { Contours, Parameters, Part, StyleId } from "../src/core/types";

let wasm: ManifoldToplevel, R: Contours[], ABGO: Contours[], GRAFO: Contours[];
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
const profiles = [
  "zigzag",
  "belly",
  "pedestal",
  "waves",
  "bumper",
  "bubble",
  "stack",
] as const;
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
  ABGO = await contoursFromSource({
    ...newProject().source,
    text: "ABGO",
    height: 100,
    spacing: 8,
  });
  GRAFO = await contoursFromSource({
    ...newProject().source,
    text: "GRAFO",
    height: 100,
    // Dejar sitio al relieve exterior entre letras; el encastre se verifica
    // en cada letra y la prueba también exige que el cartel no se superponga.
    spacing: 16,
  });
});
afterEach(() => new Promise<void>((resolve) => setImmediate(resolve)));

function solid(part: Part) {
  return new wasm.Manifold(
    new wasm.Mesh({
      numProp: 3,
      vertProperties: part.positions,
      triVerts: part.indices,
    }),
  );
}
function readStl(bytes: ArrayBuffer) {
  const data = new DataView(bytes),
    count = data.getUint32(80, true);
  expect(count).toBeGreaterThan(0);
  expect(bytes.byteLength).toBe(84 + 50 * count);
  const positions = new Float32Array(count * 9),
    indices = new Uint32Array(count * 3);
  let minArea = Infinity,
    maxNormalError = 0;
  for (let i = 0; i < count; i++) {
    const at = 84 + 50 * i;
    const normal = [0, 1, 2].map((a) => data.getFloat32(at + a * 4, true));
    for (let j = 0; j < 9; j++)
      positions[i * 9 + j] = data.getFloat32(at + 12 + j * 4, true);
    const a = positions.subarray(i * 9, i * 9 + 3),
      b = positions.subarray(i * 9 + 3, i * 9 + 6),
      c = positions.subarray(i * 9 + 6, i * 9 + 9);
    const u = [...b].map((v, j) => v - a[j]),
      v = [...c].map((v, j) => v - a[j]);
    const cross = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const area = Math.hypot(...cross);
    minArea = Math.min(minArea, area);
    maxNormalError = Math.max(
      maxNormalError,
      Math.abs(1 - cross.reduce((s, n, j) => s + n * normal[j], 0) / area),
    );
  }
  expect(minArea, "El STL contiene triángulos colapsados").toBeGreaterThan(0);
  expect(maxNormalError).toBeLessThan(0.00001);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  const mesh = new wasm.Mesh({
    numProp: 3,
    vertProperties: positions,
    triVerts: indices,
  });
  mesh.merge();
  return new wasm.Manifold(mesh);
}

interface Case {
  name: string;
  style: StyleId;
  params?: Partial<Parameters>;
  source?: "wide" | "ABGO" | "GRAFO";
}
const cases: Case[] = STYLES.map((s) => ({ name: `R · ${s.id}`, style: s.id }));
for (const profile of profiles) {
  cases.push({
    name: `GRAFO · orgánica ${profile}`,
    style: "organic",
    params: { organicProfile: profile },
    source: "GRAFO",
  });
  if (profile !== "zigzag")
    cases.push({
      name: `R · orgánica ${profile}`,
      style: "organic",
      params: { organicProfile: profile },
    });
  for (const organicFit of ["front", "back"] as const)
    for (const organicBack of ["printed", "pvc"] as const)
      cases.push({
        name: `Anillo · ${profile} · ${organicFit} · ${organicBack}`,
        style: "organic",
        params: { organicProfile: profile, organicFit, organicBack },
        source: "wide",
      });
}
for (const [name, style, params] of [
  [
    "Bandeja halo",
    "halo",
    { doubleHalo: true, backTray: true, wall: 3, innerWall: 3 },
  ],
  ["Barriga cóncava", "organic", { organicProfile: "belly", organicBelly: -5 }],
  [
    "Ondas inclinadas",
    "organic",
    { organicProfile: "waves", organicSlant: 8, organicWaveShape: 80 },
  ],
  [
    "Diez frisos",
    "organic",
    { organicProfile: "stack", organicCount: 10, organicStackGap: 1.5 },
  ],
  [
    "Frisos sin cierre",
    "organic",
    { organicProfile: "stack", organicCloseBase: false },
  ],
  [
    "Bubble cascarón redondeado",
    "organic",
    {
      organicProfile: "bubble",
      organicFace: "printed",
      organicShell: true,
      organicFaceCorner: "round",
      organicFaceAdvance: 5,
      acrylic: 4,
    },
  ],
  [
    "Frisos frente biselado",
    "organic",
    {
      organicProfile: "stack",
      organicFace: "printed",
      organicFaceCorner: "chamfer",
      organicFaceAdvance: 3,
    },
  ],
  [
    "Apoyo plano y pestaña",
    "double-support",
    { flatSupport: true, lipEnabled: true },
  ],
  [
    "Bubble plano y PVC",
    "organic",
    { flatSupport: true, organicBack: "pvc", organicProfile: "bubble" },
  ],
  [
    "Encastre con retroceso",
    "acrylic-fit",
    { outerRecess: 8, innerReduction: 10 },
  ],
  ["Neón contorno", "neon", { neonOutline: true, neonWidth: 10 }],
  ["Curva desmontable", "curved", { curveSeparate: true }],
  ["Curva 180°", "curved", { curveAngle: 180 }],
  ["Curva 220°", "curved", { curveAngle: 220 }],
] as const)
  cases.push({ name, style, params, source: "wide" });
for (const s of STYLES)
  cases.push({ name: `ABGO · ${s.id}`, style: s.id, source: "ABGO" });

describe("Fabricación: STL reales, componentes y recorrido de montaje", () => {
  for (const c of cases)
    it(
      c.name,
      async () => {
        const project = chooseStyle(newProject(), c.style);
        Object.assign(project.params, c.params);
        const model = buildModel(wasm, {
          project,
          shapes:
            c.source === "wide"
              ? wide
              : c.source === "ABGO"
                ? ABGO
                : c.source === "GRAFO"
                  ? GRAFO
                  : R,
          mode: "letters",
        });
        expect(model.parts.length).toBeGreaterThan(0);
        const solids = model.parts.map(solid);
        try {
          for (let i = 0; i < model.parts.length; i++) {
            const part = model.parts[i],
              s = solids[i],
              components = s.decompose();
            try {
              expect(s.status()).toBe("NoError");
              // Una cavidad sellada por una membrana aparece como componente de
              // volumen negativo; los apoyos flotantes añaden componentes pequeños.
              for (const component of components)
                expect(component.volume()).toBeGreaterThan(0.01);
              if (
                c.style === "organic" &&
                c.source === "wide" &&
                part.layer === "body"
              ) {
                expect(components.length).toBe(
                  project.params.organicFit === "front" &&
                    project.params.organicBack === "printed"
                    ? 1
                    : 2,
                );
                expect(
                  s.rayCast([20, 20, 5], [20, 20, model.depth + 10]),
                ).toHaveLength(0);
              }
            } finally {
              components.forEach((component) => component.delete());
            }
            // Se comprueba el archivo después de normalizar, voltear y colocar
            // en mesa, incluyendo una rotación de 90° y traslación no enteras.
            for (const bytes of [
              stl([part], true),
              stl([
                placedPart({
                  part,
                  x: 13.234,
                  y: 21.432,
                  width: 200,
                  height: 200,
                  rotated: true,
                  bed: 0,
                }),
              ]),
            ]) {
              const reopened = readStl(bytes);
              try {
                expect(reopened.status(), part.id).toBe("NoError");
                expect(reopened.boundingBox().min[2]).toBeCloseTo(0, 5);
                expect(
                  Math.abs(reopened.volume() - part.volume) / part.volume,
                ).toBeLessThan(0.0001);
              } finally {
                reopened.delete();
              }
            }
          }
          const elastic =
            c.style === "halo" &&
            project.params.backTray &&
            project.params.retention > 0;
          for (const distance of [0, 0.5, 2, 5, 15, 35, 80, model.depth + 10]) {
            if (elastic && distance > 0 && distance < model.depth + 10)
              continue;
            const moved = solids.map((s, i) =>
              s.translate([
                0,
                0,
                distance * (model.parts[i].assemblyDirection || 0),
              ]),
            );
            try {
              for (let i = 0; i < moved.length; i++)
                for (let j = i + 1; j < moved.length; j++) {
                  const intersection = moved[i].intersect(moved[j]);
                  try {
                    expect(
                      intersection.volume(),
                      `${model.parts[i].id}/${model.parts[j].id} a ${distance} mm`,
                    ).toBeLessThan(0.02);
                  } finally {
                    intersection.delete();
                  }
                }
            } finally {
              moved.forEach((s) => s.delete());
            }
          }
          // Salida opcional para inspeccionar una muestra real sin modificar el
          // proyecto del usuario. El mismo ZIP se produce desde Exportar.
          if (process.env.GRAFO_AUDIT_OUTPUT && c.name === "R · acrylic-fit") {
            project.name = "Muestra R 100 mm · Acrílico encastrable";
            project.source = {
              ...project.source,
              text: "R",
              height: 100,
              spacing: 0,
            };
            await mkdir(process.env.GRAFO_AUDIT_OUTPUT, { recursive: true });
            await writeFile(
              `${process.env.GRAFO_AUDIT_OUTPUT}/muestra-R-100-acrilico-encastrable.zip`,
              bundle(project, model),
            );
          }
        } finally {
          solids.forEach((s) => s.delete());
        }
      },
      120000,
    );
});

it("conserva el asiento del frente impreso al darle avance y orienta el cascarón para imprimir", () => {
  const project = chooseStyle(newProject(), "organic");
  Object.assign(project.params, {
    organicProfile: "bubble",
    organicFace: "printed",
    organicShell: true,
    organicFaceAdvance: 5,
  });
  const model = buildModel(wasm, { project, shapes: wide, mode: "letters" });
  const face = model.parts.find((p) => p.layer === "face")!;
  expect(face.printFlip).toBe(true);
  expect(face.bounds.max[2] - face.bounds.min[2]).toBeCloseTo(
    project.params.acrylic + 5,
    3,
  );
  const faceSolid = solid(face),
    body = solid(model.parts.find((p) => p.layer === "body")!);
  const inward = faceSolid.translate([0, 0, -0.5]),
    contact = inward.intersect(body);
  try {
    expect(contact.volume()).toBeGreaterThan(1);
  } finally {
    contact.delete();
    inward.delete();
    faceSolid.delete();
    body.delete();
  }
});

it.each([
  ["back-fit", { height: 12 }],
  ["open-back", { height: 5, pvc: 3, acrylic: 3 }],
  ["organic", { organicProfile: "bubble", height: 5, acrylic: 5 }],
  ["organic", { organicFit: "back", organicBack: "pvc", height: 10 }],
] as const)(
  "rechaza un %s sin espacio para sus placas y apoyos",
  (style, params) => {
    const project = chooseStyle(newProject(), style);
    Object.assign(project.params, params);
    expect(() =>
      buildModel(wasm, { project, shapes: wide, mode: "letters" }),
    ).toThrow("altura no alcanza");
  },
);

it("rechaza el borde trasero que no puede retener el frente por detrás del apoyo de PVC", () => {
  const project = chooseStyle(newProject(), "organic");
  Object.assign(project.params, {
    organicFit: "back",
    organicBack: "pvc",
    borderWidth: 0.5,
  });
  expect(() =>
    buildModel(wasm, { project, shapes: wide, mode: "letters" }),
  ).toThrow("borde frontal");
});
