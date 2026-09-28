// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { escucharInbox } from "./inbox-tiempo-real";

class Fuente extends EventTarget {
  static todas: Fuente[] = [];
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(readonly url: string) {
    super();
    Fuente.todas.push(this);
  }
  emitir(
    type: string,
    data: unknown = {
      empresaId: "empresa",
      usuarioId: "usuario",
      revision: "1",
    },
  ) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
}
let cerrar: () => void;
const identidad = { empresaId: "empresa", usuarioId: "usuario" };
beforeEach(() => {
  vi.useFakeTimers();
  Fuente.todas = [];
  vi.stubGlobal("EventSource", Fuente);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  cerrar?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("usa cookie del BFF, coalesce ráfagas y reconcilia al reconectar", async () => {
  const actualizar = vi.fn().mockResolvedValue(true),
    estado = vi.fn();
  cerrar = escucharInbox({
    identidad,
    actualizar,
    estado,
    accesoCerrado: vi.fn(),
  });
  const uno = Fuente.todas[0];
  expect(uno.url).toBe("/api/backend/integraciones/meta/inbox/stream");
  uno.emitir("ready");
  uno.emitir("cambio");
  uno.emitir("cambio");
  await vi.advanceTimersByTimeAsync(250);
  expect(actualizar).toHaveBeenCalledTimes(1);
  expect(estado).toHaveBeenLastCalledWith("en_vivo");
  uno.onerror?.();
  await vi.advanceTimersByTimeAsync(1000);
  expect(uno.close).toHaveBeenCalled();
  const dos = Fuente.todas[1];
  dos.emitir("ready");
  await vi.advanceTimersByTimeAsync(250);
  expect(actualizar).toHaveBeenCalledTimes(3);
  expect(estado).toHaveBeenLastCalledWith("en_vivo");
});
it("no anuncia en vivo si la lectura falla, usa respaldo y cierra al cambiar de identidad", async () => {
  const actualizar = vi.fn().mockResolvedValue(false),
    estado = vi.fn(),
    accesoCerrado = vi.fn();
  cerrar = escucharInbox({ identidad, actualizar, estado, accesoCerrado });
  Fuente.todas[0].emitir("ready");
  await vi.advanceTimersByTimeAsync(250);
  expect(estado).toHaveBeenLastCalledWith("reconectando");
  await vi.advanceTimersByTimeAsync(15250);
  expect(actualizar).toHaveBeenCalledTimes(2);
  Fuente.todas[0].emitir("cambio", {
    empresaId: "otra",
    usuarioId: "usuario",
    revision: "2",
  });
  expect(accesoCerrado).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it("recupera sin SSE, vigila conexiones silenciosas y libera listeners y peticiones", async () => {
  const actualizar = vi.fn().mockResolvedValue(true),
    estado = vi.fn();
  cerrar = escucharInbox({
    identidad,
    actualizar,
    estado,
    accesoCerrado: vi.fn(),
  });
  Fuente.todas[0].emitir("ready");
  await vi.advanceTimersByTimeAsync(250);
  await vi.advanceTimersByTimeAsync(60000);
  expect(Fuente.todas[0].close).toHaveBeenCalled();
  const signal = actualizar.mock.calls[0][0] as AbortSignal;
  cerrar();
  expect(signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  const n = Fuente.todas.length;
  window.dispatchEvent(new Event("focus"));
  expect(Fuente.todas.length).toBe(n);
});
it("no superpone consultas y recuerda un cambio recibido mientras consulta", async () => {
  let resolver!: (ok: boolean) => void;
  const actualizar = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((r) => {
          resolver = r;
        }),
    )
    .mockResolvedValue(true);
  cerrar = escucharInbox({
    identidad,
    actualizar,
    estado: vi.fn(),
    accesoCerrado: vi.fn(),
  });
  Fuente.todas[0].emitir("ready");
  await vi.advanceTimersByTimeAsync(250);
  Fuente.todas[0].emitir("cambio");
  await vi.advanceTimersByTimeAsync(250);
  expect(actualizar).toHaveBeenCalledTimes(1);
  resolver(true);
  await vi.advanceTimersByTimeAsync(250);
  expect(actualizar).toHaveBeenCalledTimes(2);
});
it("pausa cuando no hay Internet y vuelve a comprobar al regresar", async () => {
  const estado = vi.fn();
  cerrar = escucharInbox({
    identidad,
    actualizar: vi.fn().mockResolvedValue(true),
    estado,
    accesoCerrado: vi.fn(),
  });
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  window.dispatchEvent(new Event("offline"));
  expect(estado).toHaveBeenLastCalledWith("sin_conexion");
  expect(Fuente.todas[0].close).toHaveBeenCalled();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  window.dispatchEvent(new Event("online"));
  expect(Fuente.todas.length).toBe(2);
});
