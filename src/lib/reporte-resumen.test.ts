import { describe, expect, it } from "vitest";
import { fechaDelReporte, serieDelResumen } from "./reporte-resumen";

describe("presentación de la serie del Resumen ejecutivo", () => {
  it("conserva pérdidas, ceros y decimales sin modificar la serie original", () => {
    const original = [
      { fecha: "2026-09-01", monto: 80.5, costo: 100.25 },
      { fecha: "2026-09-02", monto: 0, costo: 0 },
    ];
    expect(serieDelResumen(original)).toEqual([
      { fecha: "2026-09-01", ventas: 80.5, costo: 100.25, margen: -19.75 },
      { fecha: "2026-09-02", ventas: 0, costo: 0, margen: 0 },
    ]);
    expect(original[0]).not.toHaveProperty("margen");
  });
  it("no crea puntos para un período sin datos", () =>
    expect(serieDelResumen([])).toEqual([]));
  it("distingue años en períodos mensuales y conserva el día de calendario", () => {
    expect(fechaDelReporte("2026-01-01", "dia", true)).toContain("1 de ene");
    expect(fechaDelReporte("2026-01-01", "mes")).toContain("2026");
    expect(fechaDelReporte("2025-01-01", "mes")).toContain("2025");
  });
});
