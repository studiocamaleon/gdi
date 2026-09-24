import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { DOMParser } from "linkedom";
import { readFile } from "node:fs/promises";
import {
  parseSvg,
  physicalHeight,
  contoursFromSource,
  FONT_NAMES,
} from "../src/core/source";
import { newProject } from "../src/core/project";
import { parseProject, parseJoint } from "../src/core/storage";
beforeAll(() => {
  vi.stubGlobal("DOMParser", DOMParser);
  vi.stubGlobal(
    "XMLSerializer",
    class {
      serializeToString(doc: Document) {
        return doc.toString();
      }
    },
  );
});
afterEach(() => vi.restoreAllMocks());
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="100mm" viewBox="0 0 200 100"><path fill-rule="evenodd" d="M10 20H190V80H10Z M60 40H80V60H60Z"/></svg>';
describe("Entrada vectorial y archivos de proyecto", () => {
  it("conserva la escala física del dibujo cuando el SVG tiene márgenes", async () => {
    expect(physicalHeight(svg)).toBeCloseTo(60, 5);
    const shapes = await contoursFromSource({
        ...newProject().source,
        mode: "svg",
        svg,
        height: physicalHeight(svg),
      }),
      points = shapes.flat(2);
    expect(Math.max(...points.map((p) => p[0]))).toBeCloseTo(180, 5);
    expect(Math.max(...points.map((p) => p[1]))).toBeCloseTo(60, 5);
    expect(shapes[0]).toHaveLength(2);
  });
  it("convierte pulgadas a milímetros", () => {
    expect(
      physicalHeight(
        '<svg xmlns="http://www.w3.org/2000/svg" height="1in" viewBox="0 0 96 96"><rect width="96" height="96"/></svg>',
      ),
    ).toBeCloseTo(25.4, 4);
  });
  it("no acepta contenido activo, texto sin curvas ni trazos sin expandir", () => {
    for (const content of [
      "<script/>",
      "<text>Texto</text>",
      '<image href="https://example.com/a.png"/>',
      '<rect width="10" height="10" onclick="alert(1)"/>',
      '<path fill="none" d="M0 0L10 10"/>',
    ])
      expect(() =>
        parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`),
      ).toThrow();
  });
  it("las dieciséis tipografías locales generan contornos reales", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const file = await readFile(
        new URL(`../public${String(input)}`, import.meta.url),
      );
      return new Response(Uint8Array.from(file), { status: 200 });
    });
    for (const font of FONT_NAMES) {
      const shapes = await contoursFromSource({
        ...newProject().source,
        text: "GRAFÓ",
        font,
      });
      expect(shapes.flat(2).length).toBeGreaterThan(50);
      expect(shapes.flat(3).every(Number.isFinite)).toBe(true);
    }
  });
  it("conserva el modo encastre al guardar y volver a abrir", () => {
    const p = newProject();
    p.mode = "joint";
    expect(parseProject(JSON.parse(JSON.stringify(p))).mode).toBe("joint");
  });
  it("rechaza configuraciones de producción que romperían la cotización o la mesa", () => {
    for (const overrides of [
      { bedWidth: 0 },
      { gramsHour: 0 },
      { currency: "inválida" },
      { margin: 100 },
      { priceKg: -2 },
    ]) {
      const p = newProject();
      Object.assign(p.production, overrides);
      expect(() => parseProject(p)).toThrow();
    }
  });
  it("rechaza encastres con divisiones por cero y ranuras imposibles", () => {
    for (const values of [
      { tipAngle: 0 },
      { slots: 3.5 },
      { slotLength: 30 },
      { neck: 20 },
    ])
      expect(() => parseJoint({ ...newProject().joint, ...values })).toThrow();
  });
});

it('usa 96 px por pulgada también en primitivas con unidades físicas',()=>{
  const file='<svg xmlns="http://www.w3.org/2000/svg" height="1in" viewBox="0 0 96 96"><rect width="1in" height="1in"/></svg>';
  expect(physicalHeight(file)).toBeCloseTo(25.4,5);
});
