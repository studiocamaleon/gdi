import { describe, expect, it } from "vitest";
import {
  idsFuentesVectorialesHeredadas,
  piezasVectorialesIniciales,
  piezasVectorialesValidas,
} from "./piezas-vectoriales-cotizacion";
import type { FuenteGuardada } from "./geometrias-producto-api";
import type { ConfiguracionGeometriasComerciales } from "./producto-geometrias";

const fuente = {
  schemaVersion: 2,
  nombreArchivo: "frente.dxf",
  svg: "<svg/>",
  anchoFinalMm: 100,
  altoFinalMm: 200,
  procedencia: { geometriaId: "geometria" },
} as FuenteGuardada;
const configuracion: ConfiguracionGeometriasComerciales = {
  version: 1,
  modo: "VECTORIAL",
  permitirCotizacionManual: false,
  fuentes: [
    {
      id: "principal",
      nombre: "Frente",
      requerida: true,
      predeterminada: fuente,
    },
    {
      id: "soporte",
      nombre: "Soporte",
      requerida: true,
      predeterminada: { ...fuente, nombreArchivo: "soporte.svg" },
    },
  ],
};
describe("colección comercial del producto simple", () => {
  it("inicializa todos los diseños guardados y respeta una eliminación explícita", () => {
    const piezas = piezasVectorialesIniciales(null, configuracion, null, {});
    expect(piezas.map((p) => p.id)).toEqual(["principal", "soporte"]);
    expect(piezasVectorialesIniciales([], configuracion, null, {})).toEqual([]);
    expect(
      piezasVectorialesIniciales(
        [{ ...piezas[1], cantidadPorUnidad: 4 }],
        configuracion,
        null,
        {},
      ),
    ).toEqual([{ ...piezas[1], cantidadPorUnidad: 4 }]);
  });
  it("mantiene el archivo de una cotización anterior", () => {
    const anterior = {
      ...fuente,
      schemaVersion: 1 as const,
      procedencia: undefined,
    };
    expect(
      piezasVectorialesIniciales(
        null,
        { ...configuracion, fuentes: [] },
        anterior,
        {},
      )[0].fuente,
    ).toBe(anterior);
  });
  it("rechaza cantidades inválidas y colecciones vacías o duplicadas", () => {
    const piezas = piezasVectorialesIniciales(null, configuracion, null, {});
    expect(piezasVectorialesValidas(piezas)).toBe(true);
    for (const cantidadProductos of [0, -1, 1.5, Number.NaN])
      expect(piezasVectorialesValidas(piezas, cantidadProductos)).toBe(false);
    for (const cantidadPorUnidad of [0, -1, 1.5, Number.NaN, 10001])
      expect(
        piezasVectorialesValidas([{ ...piezas[0], cantidadPorUnidad }]),
      ).toBe(false);
    expect(piezasVectorialesValidas([])).toBe(false);
    expect(piezasVectorialesValidas([piezas[0], piezas[0]])).toBe(false);
  });
});

describe("fuentes compartidas de un compuesto", () => {
  it("reutiliza la herencia y mantiene separadas las piezas fijas y otras fuentes", () => {
    const heredado = {
      configuracionJson: {
        bindings: [
          {
            clave: "disenoVectorialFuente",
            origen: "PADRE",
            regla: {
              operador: "COPIAR",
              fuente: {
                tipo: "PADRE",
                campo: "geometriasVectoriales.principal",
              },
            },
          },
        ],
      },
    };
    const ids = idsFuentesVectorialesHeredadas([
      heredado,
      heredado,
      {
        configuracionJson: {
          ...heredado.configuracionJson,
          piezas: [{ id: "fija" }],
        },
      },
      {
        configuracionJson: {
          bindings: [{ clave: "disenoVectorialFuente", origen: "COTIZACION" }],
        },
      },
    ] as never);
    expect([...ids]).toEqual(["principal"]);
    expect([
      ...idsFuentesVectorialesHeredadas([
        {
          configuracionJson: {
            ...heredado.configuracionJson,
            piezas: [{ id: "fija" }],
          },
        },
      ] as never),
    ]).toEqual([]);
  });
});
