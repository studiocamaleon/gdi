import { describe, expect, it } from "vitest";
import { medidasDxfEnUnidad, registrarImportacionDxf } from "./escala-dxf";
import type { FuenteVectorialNormalizada } from "./productos-servicios-api";

const fuente: FuenteVectorialNormalizada = {
  nombreArchivo: "exhibidor.dxf",
  formatoOrigen: "DXF",
  svg: "<svg/>",
  relacionAltoAncho: 1.704181666,
  anchoSugeridoMm: 293.065124512,
  altoSugeridoMm: 499.436212891,
  medidasOriginales: { ancho: 293.065124512, alto: 499.436212891 },
  unidadDetectada: null,
  diagnosticos: [
    {
      codigo: "dxf_capas_ocultas_omitidas",
      mensaje: "Se omitió CORTE_2.",
      severidad: "WARNING",
    },
  ],
};

describe("escala de importación DXF", () => {
  it("conserva las coordenadas originales y no inventa unidades", () => {
    expect(registrarImportacionDxf(fuente)).toMatchObject({
      unidadDetectada: null,
      anchoUnidades: 293.065124512,
      mensajes: ["Se omitió CORTE_2."],
    });
  });
  it("convierte puntos a la medida del exhibidor sin acumular escalados", () => {
    const datos = registrarImportacionDxf(fuente)!;
    expect(medidasDxfEnUnidad(datos, "pt")?.anchoFinalMm).toBeCloseTo(
      103.387,
      2,
    );
    expect(medidasDxfEnUnidad(datos, "pt")?.altoFinalMm).toBeCloseTo(176.19, 2);
    expect(medidasDxfEnUnidad(datos, "mm")?.anchoFinalMm).toBe(
      fuente.anchoSugeridoMm,
    );
    expect(medidasDxfEnUnidad(datos, "cm")?.anchoFinalMm).toBe(
      fuente.anchoSugeridoMm * 10,
    );
    expect(medidasDxfEnUnidad(datos, "desconocida")).toBeNull();
  });
  it("conserva la unidad declarada y no aplica el selector DXF a SVG", () => {
    expect(
      registrarImportacionDxf({ ...fuente, unidadDetectada: "mm" })
        ?.unidadDetectada,
    ).toBe("mm");
    expect(
      registrarImportacionDxf({ ...fuente, formatoOrigen: "SVG" }),
    ).toBeUndefined();
  });
});
