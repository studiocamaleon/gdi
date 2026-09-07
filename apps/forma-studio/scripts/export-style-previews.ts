/** Geometría propia para las miniaturas. Ejecutar desde apps/forma-studio:
 * npx tsx scripts/export-style-previews.ts /tmp/grafo3d-style-previews.json
 */
import { readFile, writeFile } from "node:fs/promises";
import Module from "manifold-3d";
import { DOMParser } from "linkedom";
import { buildModel } from "../src/core/engine";
import { STYLES, chooseStyle, newProject } from "../src/core/project";
import { contoursFromSource } from "../src/core/source";
import type { Point, Contours } from "../src/core/types";

Object.assign(globalThis, {
  DOMParser,
  XMLSerializer: class {
    serializeToString(doc: Document) {
      return doc.toString();
    }
  },
});
globalThis.fetch = (async (path: string) => {
  const font = await readFile(new URL(`../public${path}`, import.meta.url));
  return new Response(font);
}) as typeof fetch;
const wasm = await Module();
wasm.setup();
const circle = (radius: number, reverse = false): Point[] =>
  Array.from({ length: 192 }, (_, i) => {
    const angle = (i / 192) * Math.PI * 2 * (reverse ? -1 : 1);
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
const ring: Contours[] = [[circle(80), circle(30, true)]];
const previews = [];
for (const style of STYLES) {
  if (process.argv.length > 3 && !process.argv.slice(3).includes(style.id))
    continue;
  const project = chooseStyle(newProject(), style.id);
  // Ondas hace legible la familia orgánica incluso a tamaño de miniatura.
  if (style.id === "organic") {
    project.params.organicProfile = "waves";
    project.params.organicWaveAmplitude = 3;
    project.params.height = 40;
  }
  if (style.id === "perforated") {
    Object.assign(project.params, {
      patternType: "hexagon",
      patternSize: 7,
      patternSpacing: 3,
      base: 1.2,
      height: 30,
      fitBaseHeight: 20,
    });
  }
  let shapes = ring;
  if (style.id === "curved") {
    project.source.text = "3D";
    project.source.height = 90;
    project.params.curveAngle = 45;
    project.params.curveRadius = 65;
    project.params.curveCenter = 80;
    shapes = await contoursFromSource(project.source);
  }
  const model = buildModel(wasm, { project, shapes, mode: "letters" });
  const parts = model.parts.map((part) => {
    const solid = new wasm.Manifold(
      new wasm.Mesh({
        numProp: 3,
        vertProperties: part.positions,
        triVerts: part.indices,
      }),
    );
    const oriented =
      style.id === "perforated"
        ? solid.rotate([180, 0, 0]).translate([0, 0, model.depth])
        : solid;
    const display =
      style.id === "curved" ? oriented : oriented.trimByPlane([0, 1, 0], 0);
    if (display.status() !== "NoError")
      throw new Error(`${style.id}: corte inválido`);
    const mesh = display.getMesh();
    const vertices = Array.from({ length: mesh.numVert }, (_, i) =>
      Array.from(
        mesh.vertProperties.subarray(i * mesh.numProp, i * mesh.numProp + 3),
      ),
    );
    const triangles = Array.from({ length: mesh.triVerts.length / 3 }, (_, i) =>
      Array.from(mesh.triVerts.subarray(i * 3, i * 3 + 3)),
    );
    if (display !== oriented) display.delete();
    if (oriented !== solid) oriented.delete();
    solid.delete();
    return { layer: part.layer, material: part.material, vertices, triangles };
  });
  previews.push({ id: style.id, parts });
  console.log(`${style.name}: ${parts.length} piezas`);
}
await writeFile(
  process.argv[2] || "/tmp/grafo3d-style-previews.json",
  JSON.stringify(previews),
);
