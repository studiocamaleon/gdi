import { describe, expect, it } from "vitest";
import { serializarCotizacion } from "./fuentes-geometria-transporte";

describe("transporte de fuentes guardadas", () => {
  it("permite guardar dos documentos separados sin enviar marcas internas de la previsión", () => {
    const materiales = [
      { varianteId: "papel", cantidad: 14, unidad: "HOJA", consumible: false },
      { varianteId: "toner", cantidad: 2, unidad: "GR", consumible: true },
      { varianteId: "pendiente", cantidad: null, unidad: null, revisar: true },
    ];
    const request = { contextoMateriales: materiales, jobContext: { cantidad: 7 } };
    const body = JSON.parse(serializarCotizacion(request));
    expect(body.contextoMateriales).toEqual([
      { varianteId: "papel", cantidad: 14, unidad: "HOJA" },
      { varianteId: "toner", cantidad: 2, unidad: "GR" },
      { varianteId: "pendiente", cantidad: null, unidad: null },
    ]);
    expect(body.jobContext.cantidad).toBe(7);
    expect(request.contextoMateriales).toBe(materiales);
    expect(materiales[1].consumible).toBe(true);
  });
  const fuente = {
    schemaVersion: 2,
    nombreArchivo: "estante.dxf",
    svg: "<svg>" + " ".repeat(100_000) + "</svg>",
    anchoFinalMm: 300,
    fabricacion: { entidades: [{ capa: "HENDIDO", puntos: [{ x: 2, y: 3 }] }] },
    procedencia: {
      version: 1,
      geometriaId: "22222222-2222-4222-8222-222222222222",
      archivoId: "33333333-3333-4333-8333-333333333333",
      hash: "a".repeat(64),
    },
  };
  it("compacta seis archivos, fuentes principales y overrides sin modificar el editor", () => {
    const request = {
      jobContext: {
        cantidad: 50,
        disenoVectorialFuente: fuente,
        geometriasVectoriales: Object.fromEntries(
          Array.from({ length: 6 }, (_, i) => [`pieza${i}`, fuente]),
        ),
        disenosVectoriales: [{ id: "estante", cantidadPorUnidad: 4, fuente }],
        componentesConfiguracion: {
          frente: {
            ocurrencias: [
              { id: "extra", overrides: { disenoVectorialFuente: fuente } },
            ],
          },
        },
      },
    };
    const body = serializarCotizacion(request);
    const ctx = JSON.parse(body).jobContext;
    expect(body.length).toBeLessThan(4000);
    expect(ctx.disenoVectorialFuente).toEqual({
      tipo: "REFERENCIA_GEOMETRIA",
      schemaVersion: 1,
      procedencia: fuente.procedencia,
    });
    expect(
      ctx.componentesConfiguracion.frente.ocurrencias[0].overrides
        .disenoVectorialFuente,
    ).toEqual(ctx.disenoVectorialFuente);
    expect(ctx.disenosVectoriales[0].cantidadPorUnidad).toBe(4);
    expect(request.jobContext.disenoVectorialFuente).toBe(fuente);
    expect(fuente.fabricacion.entidades[0].capa).toBe("HENDIDO");
  });
  it("conserva archivos libres v1 y diseños de letras v2 sin procedencia", () => {
    const libre = { schemaVersion: 1, svg: "<svg/>", anchoFinalMm: 100 };
    const letras = {
      ...libre,
      schemaVersion: 2,
      configuracionCapas: { niveles: [] },
    };
    expect(JSON.parse(serializarCotizacion({ libre, letras }))).toEqual({
      libre,
      letras,
    });
  });
});
