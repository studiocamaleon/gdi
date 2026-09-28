// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  InboxEnviarAdjunto,
  type BorradoresMedios,
} from "./inbox-enviar-adjunto";
import type { MediosInboxApi } from "@/lib/inbox-enviar-medios";
let root: Root,
  host: HTMLDivElement,
  api: MediosInboxApi,
  borradores: BorradoresMedios,
  actualizar: ReturnType<typeof vi.fn>;
const file = new File(["%PDF-1.7 ficticio"], "muestra.pdf", {
  type: "application/pdf",
});
const aceptado = {
  id: "envio",
  clave: "c",
  estado: "ACEPTADO",
  texto: null,
  codigo: null,
  creadoEl: new Date().toISOString(),
  mensajeId: "m",
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  borradores = new Map();
  actualizar = vi.fn().mockResolvedValue(true);
  api = {
    cargar: vi.fn().mockResolvedValue("archivo"),
    enviar: vi.fn().mockResolvedValue(aceptado),
    cancelar: vi.fn().mockResolvedValue(true),
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const render = (id = "chat", habilitado = true) =>
  act(async () =>
    root.render(
      <InboxEnviarAdjunto
        key={id}
        canalId="canal"
        conversacionId={id}
        destino={id}
        habilitado={habilitado}
        api={api}
        borradores={borradores}
        actualizar={actualizar}
      >
        <textarea aria-label="Mensaje" />
      </InboxEnviarAdjunto>,
    ),
  );
async function elegir(f = file) {
  await act(async () => {
    const input = host.querySelector("input[type=file]")!;
    Object.defineProperty(input, "files", { value: [f], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
const boton = (texto: string) =>
  Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent === texto || b.getAttribute("aria-label") === texto,
  )!;
it("prepara un archivo sin enviarlo y sólo carga al confirmar", async () => {
  await render();
  await elegir();
  expect(api.cargar).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("muestra.pdf");
  await act(async () => boton("Enviar").click());
  expect(api.cargar).toHaveBeenCalledOnce();
  expect(api.enviar).toHaveBeenCalledOnce();
  expect(actualizar).toHaveBeenCalledOnce();
  expect(borradores.size).toBe(0);
});
it("descartar no envía ni sube", async () => {
  await render();
  await elegir();
  await act(async () => boton("Descartar").click());
  expect(api.enviar).not.toHaveBeenCalled();
  expect(api.cargar).not.toHaveBeenCalled();
});
it("un timeout conserva archivo y clave incluso al cambiar de conversación", async () => {
  vi.mocked(api.enviar).mockRejectedValueOnce(new Error("timeout"));
  await render();
  await elegir();
  await act(async () => boton("Enviar").click());
  const pedido = vi.mocked(api.enviar).mock.calls[0][1];
  await render("otro");
  await render();
  await act(async () => boton("Comprobar envío").click());
  expect(api.cargar).toHaveBeenCalledOnce();
  expect(api.enviar).toHaveBeenLastCalledWith(
    "chat",
    pedido,
    expect.any(AbortSignal),
  );
});
it("abortar la subida no crea un mensaje", async () => {
  let signal: AbortSignal;
  vi.mocked(api.cargar).mockImplementation((_id, _canal, _f, _v, s) => {
    signal = s;
    return new Promise((_resolve, reject) =>
      s.addEventListener("abort", () =>
        reject(new DOMException("Cancelado", "AbortError")),
      ),
    );
  });
  await render();
  await elegir();
  await act(async () => boton("Enviar").click());
  await act(async () => boton("Cancelar carga").click());
  expect(signal!.aborted).toBe(true);
  expect(api.enviar).not.toHaveBeenCalled();
  expect(borradores.size).toBe(0);
});
it("no permite adjuntos con ventana cerrada ni formatos que Meta no admite", async () => {
  await render("chat", false);
  expect(boton("Adjuntar").disabled).toBe(true);
  await elegir();
  expect(document.querySelector("[role=dialog]")).toBeNull();
  await render();
  await elegir(
    new File(["ficticio"], "arte.psd", { type: "application/octet-stream" }),
  );
  expect(api.cargar).not.toHaveBeenCalled();
  expect(host.textContent).toContain("formato o tamaño");
});
it("pegar una imagen abre su revisión sin enviarla", async () => {
  await render();
  await act(async () => {
    const e = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(e, "clipboardData", {
      value: {
        files: [new File(["png"], "imagen.png", { type: "image/png" })],
      },
    });
    host.querySelector("textarea")!.dispatchEvent(e);
  });
  expect(document.body.textContent).toContain("imagen.png");
  expect(api.enviar).not.toHaveBeenCalled();
});

function simularMicrofono() {
  const stop = vi.fn();
  const getUserMedia = vi
    .fn()
    .mockResolvedValue({ getTracks: () => [{ stop }] });
  vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });
  class Grabador {
    static isTypeSupported = (mime: string) => mime.startsWith("audio/webm");
    state = "inactive";
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({
        data: new Blob(["audio ficticio"], { type: "audio/webm" }),
      });
      this.onstop?.();
    }
  }
  vi.stubGlobal("MediaRecorder", Grabador);
  return { stop, getUserMedia };
}
it("grabar pide el micrófono al pulsarlo y enviar transmite sin vista previa", async () => {
  const { stop, getUserMedia } = simularMicrofono();
  await render();
  expect(getUserMedia).not.toHaveBeenCalled();
  await act(async () => boton("Nota de voz").click());
  expect(getUserMedia).toHaveBeenCalledOnce();
  expect(api.cargar).not.toHaveBeenCalled();
  await act(async () => boton("Enviar audio").click());
  expect(stop).toHaveBeenCalled();
  expect(document.querySelector("[role=dialog]")).toBeNull();
  expect(vi.mocked(api.cargar).mock.calls[0][3]).toBe(true);
  expect(api.enviar).toHaveBeenCalledOnce();
});
it("descartar la grabación no sube datos y cambiar de chat detiene el micrófono", async () => {
  const { stop } = simularMicrofono();
  await render();
  await act(async () => boton("Nota de voz").click());
  await act(async () => boton("Descartar grabación").click());
  expect(document.querySelector("[role=dialog]")).toBeNull();
  expect(api.cargar).not.toHaveBeenCalled();
  stop.mockClear();
  await act(async () => boton("Nota de voz").click());
  await render("otro");
  expect(stop).toHaveBeenCalled();
  expect(borradores.size).toBe(0);
});
