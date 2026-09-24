/** Regenerar la escena de marketing desde el motor real:
 * cd apps/forma-studio && npx tsx scripts/export-grafoprint-demo.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import Module from "manifold-3d";
import { DOMParser } from "linkedom";
import { buildModel } from "../src/core/engine";
import { contoursFromSource } from "../src/core/source";
import { assemblyOffset } from "../src/core/assembly";
import { grafoprintDemo, GRAFOPRINT_SVG } from "../src/core/grafoprint-demo";

Object.assign(globalThis, {
  DOMParser,
  XMLSerializer: class {
    serializeToString(doc: Document) { return doc.toString(); }
  },
});
const wasm = await Module();
wasm.setup();
const project = grafoprintDemo();
const model = buildModel(wasm, {
  project,
  shapes: await contoursFromSource(project.source),
  mode: "letters",
});
if (model.parts.length !== 3 || model.parts.some((part) => part.volume <= 0)) {
  throw new Error("El ejemplo debe generar cuerpo, acrílico y base cerrados.");
}
const destination = new URL("../../marketing/public/demos/", import.meta.url);
await mkdir(destination, { recursive: true });
await writeFile(new URL("grafoprint-isologo.svg", destination), GRAFOPRINT_SVG);
await writeFile(new URL("grafoprint-assembly.json", destination), JSON.stringify({
  frontDirection: model.frontDirection,
  parts: model.parts.map((part) => ({
    layer: part.layer,
    color: project.colors[part.layer],
    positions: Array.from(part.positions, (value) => Number(value.toFixed(4))),
    indices: Array.from(part.indices),
    offsets: Array.from({ length: 81 }, (_, distance) =>
      assemblyOffset(project, part.layer, part.assemblyDirection ?? 0, distance)),
  })),
}));
console.log(`Isologo Grafoprint: ${model.parts.length} piezas, ${model.width.toFixed(1)} × ${model.height.toFixed(1)} × ${model.depth.toFixed(1)} mm.`);
