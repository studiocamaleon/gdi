// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { subirArchivo } from "./archivos-api";
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.api }));
const requests: Xhr[] = [];
class Xhr {
  upload = { onprogress: null };
  status = 200;
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  onloadend?: () => void;
  aborted = false;
  open() {}
  setRequestHeader() {}
  getResponseHeader() {
    return "etag";
  }
  send() {
    requests.push(this);
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
    this.onloadend?.();
  }
  ok() {
    this.onload?.();
    this.onloadend?.();
  }
  fail() {
    this.onerror?.();
    this.onloadend?.();
  }
}
const file = () =>
  new File(["%PDF-prueba"], "prueba.pdf", { type: "application/pdf" });
const destino = { scope: "ORDEN" as const, entidadId: "ot-1" };
const inicio = {
  archivoId: "archivo-1",
  subida: { url: "/storage", headers: {}, expiraEn: 900 },
};
beforeEach(() => {
  vi.clearAllMocks();
  requests.length = 0;
  vi.stubGlobal("XMLHttpRequest", Xhr);
  mocks.api.mockImplementation(async (path: string) =>
    path.endsWith("/iniciar") ? inicio : { id: "archivo-1" },
  );
});
afterEach(() => vi.unstubAllGlobals());
it("confirma la subida exitosa sin cancelar su reserva", async () => {
  const tarea = subirArchivo(file(), destino);
  await vi.waitFor(() => expect(requests).toHaveLength(1));
  requests[0].ok();
  await expect(tarea).resolves.toMatchObject({ id: "archivo-1" });
  expect(mocks.api.mock.calls.map((c) => c[0])).toEqual([
    "/archivos/iniciar",
    "/archivos/archivo-1/confirmar",
  ]);
});
it("una transferencia fallida libera su reserva sin llamar a confirmar", async () => {
  const tarea = subirArchivo(file(), destino).catch((e) => e);
  await vi.waitFor(() => expect(requests).toHaveLength(1));
  requests[0].fail();
  expect(await tarea).toBeInstanceOf(Error);
  expect(mocks.api.mock.calls.map((c) => c[0])).toEqual([
    "/archivos/iniciar",
    "/archivos/archivo-1/cancelar-subida",
  ]);
});
it("si se pierde la respuesta al confirmar usa cancelar-subida, nunca el borrado de un archivo guardado", async () => {
  mocks.api.mockImplementation(async (path: string) => {
    if (path.endsWith("/iniciar")) return inicio;
    if (path.endsWith("/confirmar")) throw new Error("Respuesta perdida");
  });
  const tarea = subirArchivo(file(), destino).catch((e) => e);
  await vi.waitFor(() => expect(requests).toHaveLength(1));
  requests[0].ok();
  expect((await tarea).message).toBe("Respuesta perdida");
  expect(mocks.api).toHaveBeenLastCalledWith(
    "/archivos/archivo-1/cancelar-subida",
    { method: "POST" },
  );
  expect(mocks.api.mock.calls.some((c) => c[1]?.method === "DELETE")).toBe(
    false,
  );
});
it("una señal ya cancelada no crea una reserva", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    subirArchivo(file(), destino, undefined, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(mocks.api).not.toHaveBeenCalled();
});
it("cancelar mientras se recibe la URL libera la reserva sin iniciar el PUT", async () => {
  const controller = new AbortController();
  mocks.api.mockImplementation(async (path: string) => {
    if (path.endsWith("/iniciar")) {
      controller.abort();
      return inicio;
    }
  });
  await expect(
    subirArchivo(file(), destino, undefined, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(requests).toHaveLength(0);
  expect(mocks.api).toHaveBeenLastCalledWith(
    "/archivos/archivo-1/cancelar-subida",
    { method: "POST" },
  );
});
it("un error en multipart cancela las demás transferencias antes de liberar la reserva", async () => {
  mocks.api.mockImplementation(async (path: string) => {
    if (path.endsWith("/iniciar"))
      return {
        archivoId: "archivo-1",
        multipart: {
          uploadId: "u1",
          tamanioParte: 3,
          partes: [1, 2, 3, 4].map((numero) => ({ numero, url: `/${numero}` })),
        },
      };
    if (path.endsWith("/cancelar-subida"))
      expect(requests.every((r) => r.aborted)).toBe(true);
  });
  const tarea = subirArchivo(file(), destino).catch((e) => e);
  await vi.waitFor(() => expect(requests).toHaveLength(3));
  requests[0].fail();
  expect(await tarea).toBeInstanceOf(Error);
  expect(requests).toHaveLength(3);
  expect(mocks.api).toHaveBeenLastCalledWith(
    "/archivos/archivo-1/cancelar-subida",
    { method: "POST" },
  );
});
