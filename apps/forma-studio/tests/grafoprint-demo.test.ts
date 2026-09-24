import { beforeAll, expect, it, vi } from "vitest";
import { DOMParser } from "linkedom";
import Module from "manifold-3d";
import { grafoprintDemo, editorDraft } from "../src/core/grafoprint-demo";
import { contoursFromSource } from "../src/core/source";
import { parseProject } from "../src/core/storage";
import { buildModel } from "../src/core/engine";
import { assemblyOffset } from "../src/core/assembly";

beforeAll(() => {
  vi.stubGlobal("DOMParser", DOMParser);
  vi.stubGlobal("XMLSerializer", class { serializeToString(doc: Document) { return doc.toString(); } });
});

it("el isologo genera un solo cuerpo conectado, acrílico y base válidos", async () => {
  const wasm = await Module();
  wasm.setup();
  const project = parseProject(JSON.parse(JSON.stringify(grafoprintDemo())));
  const model = buildModel(wasm, { project, shapes: await contoursFromSource(project.source), mode: "letters" });
  expect(model.parts.map(part => part.layer).sort()).toEqual(["back", "body", "face"]);
  expect(model.height).toBeCloseTo(200, 1);
  for (const part of model.parts) {
    const solid = new wasm.Manifold(new wasm.Mesh({ numProp: 3, vertProperties: part.positions, triVerts: part.indices }));
    expect(solid.status()).toBe("NoError");
    expect(solid.volume()).toBeGreaterThan(0);
    solid.delete();
    expect(assemblyOffset(project, part.layer, part.assemblyDirection ?? 0, 0)).toBe(0);
  }
  const body = model.parts.find(part => part.layer === "body")!;
  expect(assemblyOffset(project, body.layer, body.assemblyDirection ?? 0, 80)).toBe(0);
  const face = model.parts.find(part => part.layer === "face")!;
  const back = model.parts.find(part => part.layer === "back")!;
  expect(assemblyOffset(project, back.layer, back.assemblyDirection ?? 0, 80))
    .toBeGreaterThan(assemblyOffset(project, face.layer, face.assemblyDirection ?? 0, 80));
});

it("abrir el ejemplo no reutiliza ni reemplaza el borrador habitual", () => {
  expect(editorDraft("").key).toBe("forma.autosave");
  expect(editorDraft("?ejemplo=grafoprint").key).toBe("forma.autosave.grafoprint");
  expect(editorDraft("?ejemplo=grafoprint").create().source.mode).toBe("svg");
  expect(editorDraft("?ejemplo=desconocido").key).toBe("forma.autosave");
});
