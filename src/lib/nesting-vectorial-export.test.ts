import { describe, expect, it } from "vitest";

import type { NestingViewerInput } from "@/lib/productos-servicios-api";
import {
  crearSvgDePlaca,
  obtenerFuenteVectorial,
} from "@/lib/nesting-vectorial-export";

describe("exportación de nesting vectorial", () => {
  it("recupera solamente una fuente persistida válida", () => {
    expect(
      obtenerFuenteVectorial({
        disenoVectorialFuente: {
          schemaVersion: 1,
          nombreArchivo: "logo.svg",
          svg: "<svg />",
          anchoFinalMm: 1000,
        },
      })?.nombreArchivo,
    ).toBe("logo.svg");
    expect(
      obtenerFuenteVectorial({ disenoVectorialFuente: { svg: "x" } }),
    ).toBeNull();
  });

  it("exporta sólo los contornos de la placa elegida", () => {
    const result = {
      algorithm: "irregular-2d-bottom-left-v1",
      cantidadCalculada: 2,
      unidad: "pliegos",
      aprovechamientoPct: 10,
      substrates: [
        { kind: "sheet", count: 1, widthMm: 1200, heightMm: 600 },
        { kind: "sheet", count: 1, widthMm: 1200, heightMm: 600 },
      ],
      piezasAcomodadas: 2,
      placements: [
        {
          pieceId: "P-01",
          substrateIndex: 0,
          xMm: 50,
          yMm: 50,
          widthMm: 100,
          heightMm: 100,
          rotated: false,
          meta: {
            contornos: [
              {
                puntos: [
                  { x: 50, y: 50 },
                  { x: 150, y: 50 },
                  { x: 50, y: 150 },
                ],
              },
            ],
          },
        },
        {
          pieceId: "P-02",
          substrateIndex: 1,
          xMm: 50,
          yMm: 50,
          widthMm: 80,
          heightMm: 80,
          rotated: false,
          meta: {
            contornos: [
              {
                puntos: [
                  { x: 50, y: 50 },
                  { x: 130, y: 50 },
                  { x: 50, y: 130 },
                ],
              },
            ],
          },
        },
      ],
    } satisfies NestingViewerInput;

    const svg = crearSvgDePlaca(result, 0);
    expect(svg).toContain('width="1200mm"');
    expect(svg).toContain('id="P-01-1-1"');
    expect(svg).not.toContain("P-02");
  });
});
