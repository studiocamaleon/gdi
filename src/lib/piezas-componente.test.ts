import { describe, expect, it } from "vitest";
import { piezasComponenteValidas } from "./piezas-componente";
import { construirEspecificacionesComponentes } from "./especificaciones-componentes";
import type { PiezaRectangularComponente } from "./productos-servicios-api";

const pieza: PiezaRectangularComponente = {
  id: "frente",
  tipo: "RECTANGULAR",
  nombre: "Frente",
  cantidadPorUnidad: 2,
  medidas: { anchoMm: 300, altoMm: 400 },
};
describe("colecciones de piezas con medidas", () => {
  it("impide guardar filas incompletas o con cantidades fraccionarias", () => {
    expect(piezasComponenteValidas([pieza])).toBe(true);
    for (const invalida of [
      { ...pieza, nombre: "" },
      { ...pieza, cantidadPorUnidad: 1.5 },
      { ...pieza, medidas: { anchoMm: NaN, altoMm: 100 } },
    ])
      expect(piezasComponenteValidas([invalida])).toBe(false);
  });
  it("muestra nombre, medidas, piezas por kit y total incluso con un único tipo", () => {
    const [view] = construirEspecificacionesComponentes([
      {
        codigo: "vinilo",
        nombre: "Vinilos",
        cantidad: 10,
        unidad: "conjunto",
        jobContext: {
          cantidad: 10,
          piezas: [
            {
              ...pieza.medidas,
              nombre: pieza.nombre,
              cantidadPorUnidad: 2,
              cantidad: 20,
            },
          ],
        },
      },
    ]);
    expect(view.piezas).toMatchObject({
      esConjunto: true,
      conjuntos: 10,
      porConjunto: 2,
      total: 20,
      filas: [
        {
          nombre: "Frente",
          medidas: "30 × 40 cm",
          porConjunto: 2,
          total: 20,
          archivo: null,
        },
      ],
    });
    expect(view.filas.find((f) => f.key === "medidas")).toBeUndefined();
    expect(view.resumen).toContain("20 piezas en total");
  });
});
