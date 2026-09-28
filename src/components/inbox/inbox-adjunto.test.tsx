// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InboxAdjunto } from "./inbox-adjunto";
import type { AbrirAdjuntoInbox } from "@/lib/meta-inbox-api";
const adjunto = {
  estado: "LISTO",
  nombre: "Pedido.pdf",
  mimeType: "application/pdf",
  bytes: 150,
  version: "1",
};
const archivo = {
  url: "https://files.example.invalid/privado",
  nombre: "Pedido.pdf",
  mimeType: "application/pdf",
  bytes: 150,
  expiraEn: 60,
};
let root: Root,
  container: HTMLDivElement,
  abrir: ReturnType<typeof vi.fn<AbrirAdjuntoInbox>>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  abrir = vi.fn<AbrirAdjuntoInbox>().mockResolvedValue(archivo);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
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
it("sólo solicita al abrir y permite renovar", async () => {
  await render();
  expect(abrir).not.toHaveBeenCalled();
  expect(container.querySelector("a")).toBeNull();
  await click("Abrir archivo");
  expect(container.querySelector("a")?.href).toBe(archivo.url);
  expect(abrir).toHaveBeenCalledWith("mensaje", expect.any(AbortSignal));
  await click("Renovar acceso al archivo");
  expect(abrir).toHaveBeenCalledTimes(2);
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
it("permite renovar luego de un fallo", async () => {
  abrir.mockRejectedValueOnce(new Error());
  await render();
  await click("Abrir archivo");
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  await click("Abrir archivo");
  expect(container.querySelector("a")).not.toBeNull();
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
  await click("Abrir archivo");
  const signal = abrir.mock.calls[0][1];
  await act(async () => root.render(null));
  expect(signal?.aborted).toBe(true);
  await act(async () => resolver(archivo));
  expect(container.querySelector("a")).toBeNull();
});
it("muestra la imagen enviada como documento sólo después de abrirla", async () => {
  abrir.mockResolvedValue({
    ...archivo,
    nombre: "Referencia.png",
    mimeType: "image/png",
  });
  await act(async () =>
    root.render(
      <InboxAdjunto
        mensajeId="imagen-documento"
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
  expect(container.querySelector("img")).toBeNull();
  await click("Abrir archivo");
  expect(container.querySelector("img")?.getAttribute("src")).toBe(archivo.url);
  expect(container.querySelector("img")?.alt).toBe("Referencia.png");
  expect(container.querySelector("a")?.getAttribute("aria-label")).toBe(
    "Abrir original",
  );
});
