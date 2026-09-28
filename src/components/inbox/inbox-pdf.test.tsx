// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InboxAdjunto } from "./inbox-adjunto";
import type { AbrirAdjuntoInbox, ArchivoInbox } from "@/lib/meta-inbox-api";

const adjunto = {
  estado: "LISTO",
  nombre: "Pedido.pdf",
  mimeType: "application/pdf",
  bytes: 4,
  version: "1",
};
const archivo: ArchivoInbox = {
  url: "https://files.example.invalid/descarga",
  vistaPreviaUrl: "https://files.example.invalid/visor",
  nombre: "Pedido.pdf",
  mimeType: "application/pdf",
  bytes: 4,
  expiraEn: 60,
};
let root: Root,
  container: HTMLDivElement,
  abrir: ReturnType<typeof vi.fn<AbrirAdjuntoInbox>>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Chrome");
  Object.defineProperty(navigator, "pdfViewerEnabled", {
    value: true,
    configurable: true,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  abrir = vi.fn<AbrirAdjuntoInbox>().mockResolvedValue(archivo);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(
      async () =>
        new Response("%PDF", {
          headers: { "content-type": "application/pdf" },
        }),
    ),
  );
  URL.createObjectURL = vi.fn().mockReturnValue("blob:pdf");
  URL.revokeObjectURL = vi.fn();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function render() {
  await act(async () =>
    root.render(
      <InboxAdjunto
        mensajeId="mensaje-pdf"
        tipo="document"
        adjunto={adjunto}
        abrir={abrir}
      />,
    ),
  );
}
async function click(nombre: string) {
  const button = [...document.querySelectorAll("button")].find(
    (b) =>
      b.getAttribute("aria-label") === nombre ||
      b.textContent?.trim() === nombre,
  );
  expect(button).toBeDefined();
  await act(async () => {
    button!.focus();
    button!.click();
  });
}
it("abre inline sólo al pedirlo y conserva una descarga separada", async () => {
  await render();
  expect(abrir).not.toHaveBeenCalled();
  expect(document.querySelector("iframe")).toBeNull();
  await click("Ver PDF");
  expect(abrir).toHaveBeenCalledWith("mensaje-pdf", expect.any(AbortSignal));
  expect(document.querySelector("iframe")?.src).toBe(
    "blob:pdf#view=FitH&navpanes=0",
  );
  expect(document.querySelector("iframe")?.title).toBe(
    "Vista previa de Pedido.pdf",
  );
  expect(
    document.querySelector('[role="dialog"] a')?.getAttribute("href"),
  ).toBe("blob:pdf");
  await click("Cerrar visor PDF");
  expect(document.querySelector("iframe")).toBeNull();
  abrir.mockResolvedValueOnce({
    ...archivo,
    vistaPreviaUrl: `${archivo.vistaPreviaUrl}-nueva`,
  });
  await click("Ver PDF");
  expect(abrir).toHaveBeenCalledTimes(2);
  expect(document.querySelector("iframe")?.src).toBe(
    "blob:pdf#view=FitH&navpanes=0",
  );
});
it("permite reintentar tras un error sin abrir la descarga en el visor", async () => {
  abrir.mockRejectedValueOnce(new Error("Sin acceso"));
  await render();
  await click("Ver PDF");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "No pudimos abrir",
  );
  expect(document.querySelector("iframe")).toBeNull();
  await click("Volver a intentar");
  expect(document.querySelector("iframe")?.src).toBe(
    "blob:pdf#view=FitH&navpanes=0",
  );
});
it("cancela al cerrar y descarta una autorización tardía", async () => {
  let resolver!: (value: ArchivoInbox) => void;
  abrir.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  );
  await render();
  await click("Ver PDF");
  const signal = abrir.mock.calls[0][1];
  expect(document.querySelector('[role="status"]')?.textContent).toContain(
    "Abriendo PDF",
  );
  await click("Cerrar visor PDF");
  expect(signal?.aborted).toBe(true);
  await act(async () => resolver(archivo));
  expect(document.querySelector("iframe")).toBeNull();
});
it("no incrusta otro formato si la API devuelve un documento distinto", async () => {
  abrir.mockResolvedValue({ ...archivo, mimeType: "text/html" });
  await render();
  await click("Ver PDF");
  expect(document.querySelector("iframe")).toBeNull();
  expect(document.querySelector('[role="dialog"] a')).toBeNull();
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
});
it("puede mostrar el PDF sin requerir una segunda URL de preview", async () => {
  abrir.mockResolvedValue({ ...archivo, vistaPreviaUrl: undefined });
  await render();
  await click("Ver PDF");
  expect(document.querySelector("iframe")?.src).toBe(
    "blob:pdf#view=FitH&navpanes=0",
  );
  expect(
    document.querySelector('[role="dialog"] a')?.getAttribute("href"),
  ).toBe("blob:pdf");
});
it("explica la falta de visor del navegador sin disparar una descarga", async () => {
  Object.defineProperty(navigator, "pdfViewerEnabled", {
    value: false,
    configurable: true,
  });
  await render();
  await click("Ver PDF");
  expect(document.querySelector("iframe")).toBeNull();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "Este navegador",
  );
});
it("mantiene visor y descarga disponibles después del vencimiento de la firma", async () => {
  vi.useFakeTimers();
  await render();
  await click("Ver PDF");
  await act(async () => {
    vi.advanceTimersByTime(120000);
  });
  expect(
    document.querySelector('[role="dialog"] a')?.getAttribute("href"),
  ).toBe("blob:pdf");
  expect(document.querySelector("iframe")).not.toBeNull();
  expect(abrir).toHaveBeenCalledOnce();
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toMatch(
    /renovar/i,
  );
  await click("Cerrar visor PDF");
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:pdf");
});
