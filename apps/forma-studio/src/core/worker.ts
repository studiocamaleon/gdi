import Module from "manifold-3d";
import wasmUrl from "manifold-3d/manifold.wasm?url";
import { buildModel } from "./engine";
import type { EngineInput } from "./types";
const ready = Module({ locateFile: () => wasmUrl }).then((w) => {
  w.setup();
  return w;
});
self.onmessage = async (
  event: MessageEvent<{ id: number; input: EngineInput }>,
) => {
  const { id, input } = event.data;
  try {
    const model = buildModel(await ready, input);
    self.postMessage({ id, model });
  } catch (error) {
    self.postMessage({
      id,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo generar el modelo.",
    });
  }
};
