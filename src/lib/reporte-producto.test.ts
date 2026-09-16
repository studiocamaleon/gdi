import { describe, expect, it } from "vitest";
import {
  cantidadMaterialProducto,
  prepararMixProducto,
} from "./reporte-producto";

describe("Evolución del mix de productos", () => {
  it("suma puntos repetidos, conserva fechas calendario y no agrega días ausentes", () => {
    const result = prepararMixProducto([
      { fecha: "2026-09-04", nombre: "Vinilo", monto: 12.25 },
      { fecha: "2026-09-04", nombre: "Vinilo", monto: 4.5 },
      { fecha: "2026-09-06", nombre: "Tarjetas", monto: 8 },
    ]);
    expect(result.data.map((d) => d.fecha)).toEqual([
      "2026-09-04",
      "2026-09-06",
    ]);
    expect(result.series.map((s) => s.total)).toEqual([16.75, 8]);
    expect(result.data).toEqual([
      { fecha: "2026-09-04", serie0: 16.75, serie1: 0 },
      { fecha: "2026-09-06", serie0: 0, serie1: 8 },
    ]);
  });
  it("agrupa el resto sin perder ventas ni confundir un producto llamado Otros", () => {
    const puntos = Array.from({ length: 9 }, (_, i) => ({
      fecha: "2026-09-01",
      nombre: i === 0 ? "Otros" : `Producto ${i}`,
      monto: 9 - i,
    }));
    const result = prepararMixProducto(puntos);
    expect(result.agrupadas).toBe(3);
    expect(result.series[0].nombre).toBe("Otros");
    expect(result.series.at(-1)).toEqual({
      key: "resto",
      nombre: "Resto (agrupado)",
      total: 6,
    });
    expect(result.series.reduce((s, c) => s + c.total, 0)).toBe(45);
    expect(
      Object.values(result.data[0])
        .filter((v) => typeof v === "number")
        .reduce<number>((s, v) => s + Number(v), 0),
    ).toBe(45);
  });
  it("conserva negativos y nombres que coinciden con claves reservadas", () => {
    const result = prepararMixProducto([
      { fecha: "2026-09-01", nombre: "fecha", monto: 20 },
      { fecha: "2026-09-01", nombre: "__proto__", monto: -2.55 },
    ]);
    expect(result.data[0]).toEqual({
      fecha: "2026-09-01",
      serie0: 20,
      serie1: -2.55,
    });
  });
  it("admite un único período y una serie vacía", () => {
    expect(prepararMixProducto([])).toEqual({
      data: [],
      series: [],
      agrupadas: 0,
    });
    expect(
      prepararMixProducto([{ fecha: "2026-09-01", nombre: "A", monto: 0 }])
        .data,
    ).toHaveLength(1);
  });
});
describe("Cantidades teóricas de materiales", () => {
  it.each([
    [0.25, "ml", null, "0,25 ml"],
    [1.01, "gramo", null, "1,01 g"],
    [1000.01, "gramo", null, "1,00001 kg"],
    [6.24, "metro_lineal", null, "6,24 m lineales"],
    [1, "hoja", "SRA3", "1 hoja · SRA3"],
    [1.75, "pliego", null, "1,75 pliegos"],
    [3.45, "unidad_futura", null, "3,45 unidad_futura"],
  ])("preserva %s %s con formato %s", (cantidad, unidad, formato, expected) => {
    expect(
      cantidadMaterialProducto({
        cantidad: Number(cantidad),
        unidad: String(unidad),
        formato: formato as string | null,
      }),
    ).toBe(expected);
  });
});
