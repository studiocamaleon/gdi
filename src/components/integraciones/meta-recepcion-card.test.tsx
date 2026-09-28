// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { MetaRecepcionCard } from "./meta-recepcion-card";
import { getMetaRecepcion, type RecepcionMeta } from "@/lib/meta-recepcion-api";
vi.mock("@/lib/meta-recepcion-api", () => ({ getMetaRecepcion: vi.fn() }));
let container: HTMLDivElement, root: Root;
const inicial: RecepcionMeta = {
  contacto: "+16505550123",
  mensajes: [
    {
      id: "mensaje-1",
      remitente: "+16505550123",
      nombreContacto: "Contacto ficticio",
      tipo: "text",
      texto: "<img src=x onerror=alert(1)>\nHola 👋",
      enviadoEl: "2026-09-25T21:00:00.000Z",
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const render = (datos = inicial) =>
  act(async () => root.render(<MetaRecepcionCard inicial={datos} />));
async function actualizar() {
  const boton = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Actualizar mensajes"),
  )!;
  await act(async () => boton.click());
}
it("renderiza el texto como contenido, sin interpretar HTML ni cargar adjuntos", async () => {
  await render();
  expect(container.textContent).toContain(inicial.mensajes[0].texto);
  expect(container.querySelector("img")).toBeNull();
  vi.mocked(getMetaRecepcion).mockResolvedValue({
    ...inicial,
    mensajes: [{ ...inicial.mensajes[0], tipo: "image", texto: null }],
  });
  await actualizar();
  expect(container.textContent).toContain(
    "Este contenido todavía no se puede visualizar",
  );
  expect(container.querySelector("img")).toBeNull();
});
it("explica el estado vacío y permite consultar nuevos mensajes", async () => {
  await render({ ...inicial, mensajes: [] });
  expect(container.textContent).toContain("Todavía no hay mensajes recibidos");
  vi.mocked(getMetaRecepcion).mockResolvedValue(inicial);
  await actualizar();
  expect(container.textContent).toContain("Contacto ficticio");
  expect(getMetaRecepcion).toHaveBeenCalledTimes(1);
});
it("retira los mensajes si el acceso dejó de estar habilitado", async () => {
  await render();
  vi.mocked(getMetaRecepcion).mockResolvedValue(null);
  await actualizar();
  expect(container.textContent).toContain("Recepción no disponible");
  expect(container.textContent).not.toContain("Contacto ficticio");
});
it("no deja conversaciones visibles después de un error de sesión y permite recuperarse", async () => {
  await render();
  vi.mocked(getMetaRecepcion).mockRejectedValueOnce(
    new Error("sesión vencida"),
  );
  await actualizar();
  expect(container.textContent).toContain("No pudimos actualizar");
  expect(container.textContent).not.toContain("Contacto ficticio");
  vi.mocked(getMetaRecepcion).mockResolvedValue(inicial);
  await actualizar();
  expect(container.textContent).toContain("Contacto ficticio");
});
