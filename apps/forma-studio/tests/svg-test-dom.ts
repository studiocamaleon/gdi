import { JSDOM } from "jsdom";
import { afterAll, beforeAll, vi } from "vitest";

// El motor WASM debe seguir ejecutándose en Node. Sólo el parser y DOMPurify
// reciben un DOM real; definir window global haría que Manifold cargara como web.
const dom = new JSDOM("");
beforeAll(() => {
  vi.stubGlobal("DOMParser", dom.window.DOMParser);
  vi.stubGlobal("XMLSerializer", dom.window.XMLSerializer);
});
afterAll(() => {
  vi.unstubAllGlobals();
  dom.window.close();
});
vi.mock("dompurify", async (importOriginal) => {
  const { default: createDOMPurify } =
    await importOriginal<typeof import("dompurify")>();
  const { JSDOM } = await import("jsdom");
  return { default: createDOMPurify(new JSDOM("").window) };
});
