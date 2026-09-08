import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, ApiError } from "./api";
import { cotizarEnSegundoPlano, analizarSvgFabricacionEnWorker } from "./productos-servicios-api";

vi.mock("@/lib/session", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/lib/api", async (original) => ({
  ...await original<typeof import("./api")>(),
  apiRequest: vi.fn(),
}));

const solicitar = vi.mocked(apiRequest);
const pendiente = { id: "trabajo-1", estado: "procesando" };
const terminado = { id: "trabajo-1", estado: "completado", resultado: { exitoso: true } };

beforeEach(() => { vi.useFakeTimers(); solicitar.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe("observación de cálculos durables", () => {
  it("espera una cotización de dos minutos sin agotar las 100 consultas por minuto", async () => {
    const inicio = Date.now();
    const consultas: number[] = [];
    solicitar.mockImplementation(async (_path, init) => {
      if (init?.method === "POST") return pendiente;
      consultas.push(Date.now() - inicio);
      return Date.now() - inicio >= 120_000 ? terminado : pendiente;
    });
    const promesa = cotizarEnSegundoPlano({ productoId: "producto", jobContext: { cantidad: 50 } }, { claveSolicitud: "prueba" });
    await vi.advanceTimersByTimeAsync(121_000);
    await expect(promesa).resolves.toEqual(terminado.resultado);
    expect(consultas.filter(t => t <= 60_000).length).toBeLessThan(20);
    expect(solicitar.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it.each(["cotización", "nesting"])("reanuda el mismo trabajo de %s tras un 429", async (tipo) => {
    solicitar.mockResolvedValueOnce(pendiente)
      .mockRejectedValueOnce(new ApiError("Too many requests", 429, 3))
      .mockResolvedValueOnce(terminado);
    const promesa = tipo === "cotización"
      ? cotizarEnSegundoPlano({ productoId: "p", jobContext: { cantidad: 1 } }, { claveSolicitud: "prueba" })
      : analizarSvgFabricacionEnWorker({ svg: "<svg/>", nombreArchivo: "pieza.svg", anchoFinalMm: 10, cantidad: 1, anchoPlacaMm: 100, altoPlacaMm: 100 });
    await vi.advanceTimersByTimeAsync(3_999);
    expect(solicitar).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promesa).resolves.toEqual(terminado.resultado);
    expect(solicitar.mock.calls[1][0]).toBe(solicitar.mock.calls[2][0]);
  });

  it("permite cancelar durante la espera por límite de solicitudes", async () => {
    solicitar.mockResolvedValueOnce(pendiente).mockRejectedValueOnce(new ApiError("Límite", 429));
    const controller = new AbortController();
    const promesa = cotizarEnSegundoPlano({ productoId: "p", jobContext: { cantidad: 1 } }, { claveSolicitud: "prueba", signal: controller.signal });
    const comprobacion = expect(promesa).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();
    await comprobacion;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(solicitar).toHaveBeenCalledTimes(2);
  });
});
