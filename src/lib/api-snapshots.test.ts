import { afterEach, expect, it, vi } from "vitest";
import { compactarJson } from "../../apps/api/src/common/json-compartido";
vi.mock("@/lib/session", () => ({ getSessionToken: async () => null }));
import { apiRequest } from "./api";

afterEach(() => vi.unstubAllGlobals());
it("anuncia soporte y restaura el resultado antes de entregarlo a las pantallas", async () => {
  const contorno = Array.from({ length: 300 }, (_, i) => ({
    x: i / 7,
    y: i / 3,
  }));
  const resultado = {
    piezas: Array.from({ length: 100 }, (_, i) => ({ id: i, contorno })),
  };
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(compactarJson(resultado))));
  vi.stubGlobal("fetch", fetch);
  expect(await apiRequest("/cotizaciones/prueba")).toEqual(resultado);
  expect(fetch.mock.calls[0][1].headers.get("Accept")).toContain(
    "application/vnd.grafoprint.snapshot+json",
  );
});
it("sigue leyendo respuestas históricas y conserva los errores del API", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('{"cantidad":150}'))
    .mockResolvedValueOnce(
      new Response('{"message":"Cotización no encontrada"}', { status: 404 }),
    );
  vi.stubGlobal("fetch", fetch);
  expect(await apiRequest("/cotizaciones/prueba")).toEqual({ cantidad: 150 });
  await expect(apiRequest("/cotizaciones/inexistente")).rejects.toThrow(
    "Cotización no encontrada",
  );
});
