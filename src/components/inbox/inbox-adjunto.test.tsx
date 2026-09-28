// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InboxAdjunto } from "./inbox-adjunto";
import type { AbrirAdjuntoInbox } from "@/lib/meta-inbox-api";
const adjunto = {
  estado: "LISTO",
  nombre: "Pedido.docx",
  mimeType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  bytes: 4,
  version: "1",
};
const archivo = {
  url: "https://files.example.invalid/privado",
  nombre: "Pedido.docx",
  mimeType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  bytes: 4,
  expiraEn: 60,
};
let root: Root,
  container: HTMLDivElement,
  abrir: ReturnType<typeof vi.fn<AbrirAdjuntoInbox>>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe() {
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  abrir = vi.fn<AbrirAdjuntoInbox>().mockResolvedValue(archivo);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(
        async () =>
          new Response("data", { headers: { "content-type": "image/png" } }),
      ),
  );
  URL.createObjectURL = vi.fn().mockReturnValue("blob:imagen");
  URL.revokeObjectURL = vi.fn();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const render = (estado = "LISTO") =>
  act(async () =>
    root.render(
      <InboxAdjunto
        mensajeId="mensaje"
        tipo="document"
        adjunto={{ ...adjunto, estado }}
        abrir={abrir}
      />,
    ),
  );
async function click(texto: string) {
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === texto || b.getAttribute("aria-label") === texto,
  )!;
  await act(async () => button.click());
}
it("descarga con un clic y solicita un acceso nuevo en cada descarga", async () => {
  await render();
  expect(abrir).not.toHaveBeenCalled();
  await click("Descargar archivo");
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  expect(abrir).toHaveBeenCalledWith("mensaje", expect.any(AbortSignal));
  await click("Descargar archivo");
  expect(abrir).toHaveBeenCalledTimes(2);
  expect(container.textContent).not.toMatch(/renovar/i);
});
it.each([
  "SIN_ARCHIVO",
  "NO_DISPONIBLE",
  "REVISION",
  "PENDIENTE",
  "DESCARGANDO",
  "DESHABILITADO",
])("no simula descargas: %s", async (estado) => {
  await render(estado);
  expect(container.querySelector("button")).toBeNull();
  expect(container.querySelector('[role="status"]')).not.toBeNull();
  expect(abrir).not.toHaveBeenCalled();
});
it("permite reintentar luego de un fallo", async () => {
  abrir.mockRejectedValueOnce(new Error());
  await render();
  await click("Descargar archivo");
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  await click("Descargar archivo");
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
});
it("cancela al cambiar de conversación y descarta respuesta tardía", async () => {
  let resolver!: (v: typeof archivo) => void;
  abrir.mockImplementation(
    () =>
      new Promise((r) => {
        resolver = r;
      }),
  );
  await render();
  await click("Descargar archivo");
  const signal = abrir.mock.calls[0][1];
  await act(async () => root.render(null));
  expect(signal?.aborted).toBe(true);
  await act(async () => resolver(archivo));
  expect(container.querySelector("a")).toBeNull();
});
it("muestra y permite ampliar una imagen enviada como documento sin paso manual", async () => {
  abrir.mockResolvedValue({
    ...archivo,
    nombre: "Referencia.png",
    mimeType: "image/png",
  });
  await act(async () =>
    root.render(
      <InboxAdjunto
        mensajeId="imagen"
        tipo="document"
        adjunto={{
          ...adjunto,
          nombre: "Referencia.png",
          mimeType: "image/png",
        }}
        abrir={abrir}
      />,
    ),
  );
  expect(container.querySelector("img")?.src).toBe("blob:imagen");
  expect(
    container.querySelector('[aria-label="Ampliar Referencia.png"]'),
  ).not.toBeNull();
  expect(container.querySelector("a")).toBeNull();
  expect(container.querySelector("strong")).toBeNull();
  await click("Ampliar Referencia.png");
  const visor = document.querySelector('[role="dialog"]');
  expect(visor?.querySelector("img")?.src).toBe("blob:imagen");
  expect(visor?.querySelector("a")?.download).toBe("Referencia.png");
  await act(async () => root.render(null));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:imagen");
});
