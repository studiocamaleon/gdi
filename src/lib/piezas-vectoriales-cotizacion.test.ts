import { describe, expect, it } from "vitest";
import {
  idsFuentesVectorialesHeredadas,
  disenoCompartidoListo,
  piezasVectorialesIniciales,
  piezasVectorialesValidas,
} from "./piezas-vectoriales-cotizacion";
import type { FuenteGuardada } from "./geometrias-producto-api";
import type { ConfiguracionGeometriasComerciales } from "./producto-geometrias";
import { piezasComponenteValidas } from "./piezas-componente";
import { MAX_PIEZAS_VECTORIALES } from "./limites-piezas-vectoriales";

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
  it.each([31, 50, MAX_PIEZAS_VECTORIALES])(
    "admite %i diseños en productos y componentes",
    (cantidad) => {
      const piezas = Array.from({ length: cantidad }, (_, i) => ({
        id: `pieza-${i}`,
        nombre: `Pieza ${i + 1}`,
        cantidadPorUnidad: 1,
        fuente,
      }));
      expect(piezasVectorialesValidas(piezas)).toBe(true);
      expect(piezasComponenteValidas(piezas)).toBe(true);
    },
  );
  it("mantiene el límite de capacidad del motor sin aceptar duplicados", () => {
    const piezas = Array.from(
      { length: MAX_PIEZAS_VECTORIALES + 1 },
      (_, i) => ({
        id: `pieza-${i}`,
        nombre: `Pieza ${i + 1}`,
        cantidadPorUnidad: 1,
        fuente,
      }),
    );
    expect(piezasVectorialesValidas(piezas)).toBe(false);
    expect(piezasComponenteValidas(piezas)).toBe(false);
  });
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
  it("habilita el cálculo de cada material sin exigir un nesting previo del padre", () => {
    const cfg = { ...configuracion, fuentes: [configuracion.fuentes[0]] };
    const fuentes = {
      principal: {
        ...fuente,
        schemaVersion: 1 as const,
        procedencia: undefined,
      },
    };
    expect(disenoCompartidoListo("COMPUESTO", cfg, fuentes)).toBe(true);
    expect(disenoCompartidoListo("SIMPLE", cfg, fuentes)).toBe(false);
    expect(disenoCompartidoListo("COMPUESTO", configuracion, fuentes)).toBe(
      false,
    );
    expect(
      disenoCompartidoListo("COMPUESTO", cfg, {
        principal: { ...fuentes.principal, anchoFinalMm: 0 },
      }),
    ).toBe(false);
    expect(disenoCompartidoListo("COMPUESTO", cfg, {})).toBe(false);
  });
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
