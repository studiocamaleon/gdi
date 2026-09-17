import { afterEach, describe, expect, it, vi } from "vitest";
import { esperarPdf } from "./esperar-pdf";

afterEach(() => vi.useRealTimers());
describe("espera del PDF", () => {
  it("abre el archivo guardado después de esperar la generación", async () => {
    vi.useFakeTimers();
    const consultar = vi
      .fn()
      .mockResolvedValueOnce({ estado: "preparando", reintentarEnMs: 2000 })
      .mockResolvedValueOnce({
        estado: "listo",
        url: "https://storage.test/pdf",
      });
    const resultado = esperarPdf(consultar, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await resultado).toEqual({
      estado: "listo",
      url: "https://storage.test/pdf",
    });
    expect(consultar).toHaveBeenCalledTimes(2);
  });
  it("detiene las consultas si falla la generación", async () => {
    const consultar = vi
      .fn()
      .mockResolvedValue({ estado: "fallido", error: "Sin espacio" });
    expect(
      await esperarPdf(consultar, new AbortController().signal),
    ).toMatchObject({ estado: "fallido" });
    expect(consultar).toHaveBeenCalledTimes(1);
  });
  it("acota la espera para permitir volver a consultar manualmente", async () => {
    vi.useFakeTimers();
    const consultar = vi
      .fn()
      .mockResolvedValue({ estado: "preparando", reintentarEnMs: 2000 });
    const resultado = esperarPdf(consultar, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(await resultado).toMatchObject({ estado: "preparando" });
    const total = consultar.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(consultar).toHaveBeenCalledTimes(total);
  });
  it("cancela el polling al abandonar la pantalla", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const consultar = vi
      .fn()
      .mockResolvedValue({ estado: "preparando", reintentarEnMs: 2000 });
    const resultado = esperarPdf(consultar, controller.signal);
    const rechazado = expect(resultado).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await rechazado;
    await vi.advanceTimersByTimeAsync(10000);
    expect(consultar).toHaveBeenCalledTimes(1);
  });
});
