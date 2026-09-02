import { describe, expect, it } from "vitest";

import type {
  ProductoReceta,
  ProductoRecetaComponenteInput,
  ProductoRecetaRevision,
} from "@/lib/productos-servicios-api";
import {
  actualizarPoliticaPricingComponente,
  componentesPricingKey,
  crearComponentesPricingPorRuta,
  leerPoliticaPricingComponente,
  revisionPricingReceta,
} from "./pricing-compuesto-helpers";
import { normalizePrecioConfig, precioConfigKey } from "./tab-precio-editor";

function componenteLegacy(): ProductoRecetaComponenteInput {
  return {
    productoComponenteId: "hijo-1",
    codigo: "H-1",
    nombre: "Componente uno",
    formula: "por_unidad",
    cantidad: 2,
    unidad: "unidad",
    requerido: true,
    configuracionJson: null,
  };
}

function revision(
  estado: ProductoRecetaRevision["estado"],
  updatedAt: string,
): ProductoRecetaRevision {
  return {
    id: `${estado}-${updatedAt}`,
    numero: estado === "BORRADOR" ? 2 : 1,
    estado,
    rutaAlternativaId: "ruta-1",
    rutaVersion: 1,
    huellaConfiguracion: "huella",
    topologiaProduccion: "LINEAL",
    cambios: null,
    creadaPorNombre: "Test",
    createdAt: updatedAt,
    updatedAt,
    materiales: [],
    recursos: [],
    componentes: [],
    documentos: [],
  };
}

describe("pricing compuesto en la interfaz", () => {
  it("preserva la estrategia compuesta al normalizar la regla general", () => {
    const config = normalizePrecioConfig({
      metodoCalculo: "por_margen",
      detalle: { marginPct: 35 },
      compuesto: { version: 1, estrategia: "MIXTO" },
    });

    expect(config.compuesto).toEqual({ version: 1, estrategia: "MIXTO" });
    expect(precioConfigKey(config)).toContain('"estrategia":"MIXTO"');
  });

  it("interpreta una relación histórica como heredada", () => {
    expect(leerPoliticaPricingComponente(null)).toEqual({
      version: 1,
      modo: "HEREDAR_PADRE",
    });
  });

  it("agrega pricing a una relación legacy sin cambiar su multiplicador", () => {
    const actualizado = actualizarPoliticaPricingComponente(
      componenteLegacy(),
      "OVERRIDE",
      {
        metodoCalculo: "precio_fijo",
        detalle: { price: 125 },
      },
    );

    expect(actualizado.configuracionJson?.bindings).toEqual([
      expect.objectContaining({
        clave: "cantidad",
        origen: "FORMULA",
        regla: expect.objectContaining({
          campoPadre: "cantidad",
          operador: "MULTIPLICAR",
          valor: 2,
        }),
      }),
    ]);
    expect(actualizado.configuracionJson?.pricing).toEqual({
      version: 1,
      modo: "OVERRIDE",
      precioConfigOverride: {
        metodoCalculo: "precio_fijo",
        detalle: { price: 125 },
      },
    });
  });

  it("prefiere el borrador de receta y proyecta sus componentes", () => {
    const publicada = revision("PUBLICADA", "2026-09-01T10:00:00.000Z");
    const borrador = revision("BORRADOR", "2026-09-02T10:00:00.000Z");
    borrador.componentes = [
      {
        id: "rel-1",
        productoComponenteId: "hijo-1",
        codigo: "H-1",
        nombre: "Componente uno",
        recetaRevisionId: borrador.id,
        recetaVersion: 1,
        recetaHuella: "hijo-huella",
        politicaEjecucion: "INLINE",
        formula: "por_unidad",
        cantidad: 2,
        unidad: "unidad",
        requerido: true,
        configuracionJson: null,
        orden: 0,
        nodosPredecesoresClaves: [],
        nodoIncorporacionClave: null,
      },
    ];
    const receta: ProductoReceta = {
      id: "receta-1",
      codigo: "R-1",
      nombre: "Ruta uno",
      rutaAlternativa: {
        id: "ruta-1",
        nombre: "Principal",
        rutaVersion: 1,
        activo: true,
      },
      revisionPublicada: publicada,
      revisiones: [publicada, borrador],
    };

    expect(revisionPricingReceta(receta)?.id).toBe(borrador.id);
    expect(crearComponentesPricingPorRuta([receta])["ruta-1"]).toEqual([
      expect.objectContaining({ codigo: "H-1", cantidad: 2 }),
    ]);
  });

  it("compara el estado de rutas sin depender del orden de las claves", () => {
    const componente = componenteLegacy();
    expect(
      componentesPricingKey({ rutaB: [], rutaA: [componente] }),
    ).toBe(componentesPricingKey({ rutaA: [componente], rutaB: [] }));
  });
});
