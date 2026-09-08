import { describe, expect, it } from "vitest";
import type { ProductoDetalle } from "@/lib/productos-servicios";
import type { AnalisisSvgFabricacion } from "@/lib/productos-servicios-api";
import {
  buildJobContext,
  DEFAULT_MOTOR_CONFIG,
} from "./agregar-producto-sheet";

function productoPolyfan(): ProductoDetalle {
  return {
    modoMedidas: "LIBRE",
    unidadComercial: "unidad",
    atributosComercialesJson: {},
    medidasPredefinidasJson: [],
    rutasAlternativas: [{
      id: "ruta-polyfan",
      esPreferida: true,
      ruta: { pasos: [] },
      configPasos: [{
        id: "corte",
        rutaPasoId: "paso-corte",
        rutaPaso: {
          familiaCodigo: "corte_hilo_caliente",
          herramientasCotizacion: ["diseno_vectorial"],
        },
        modoActivacion: "OBLIGATORIO",
        paramsPasoJson: {},
        slotsMateriales: [],
        maquinaM1: null,
        perfilM1: null,
      }],
    }],
  } as unknown as ProductoDetalle;
}

function configVectorial(): typeof DEFAULT_MOTOR_CONFIG {
  return {
    ...DEFAULT_MOTOR_CONFIG,
    // Al elegir un producto LIBRE, el sheet inicializa esta fila oculta.
    piezas: [{ uiKey: "inicial", cantidad: 1, anchoMm: 0, altoMm: 0 }],
    disenoVectorialFuente: {
      schemaVersion: 1,
      nombreArchivo: "polyfan.svg",
      svg: '<svg viewBox="0 0 1000 400"/>',
      anchoFinalMm: 1000,
      altoFinalMm: 400,
    },
    disenoVectorialAnalisis: {
      cacheKey: "nesting-de-dos-carteles",
      geometria: {
        anchoMm: 1000,
        altoMm: 400,
        areaTotalMm2: 170_000,
        perimetroTotalMm: 4000,
        piezas: ["L", "A", "triangulo"].map((id) => ({
          id,
          anchoMm: 300,
          altoMm: 400,
          perimetroMm: 4000 / 3,
        })),
      },
    } as AnalisisSvgFabricacion,
  };
}

describe("cantidad enviada a cotización y al snapshot del ítem", () => {
  it.each([2, 3])("conserva %i carteles y sus tres formas sin sumar ni multiplicar dos veces", (cantidad) => {
    const ctx = buildJobContext(productoPolyfan(), configVectorial(), cantidad, []);

    expect(ctx.cantidad).toBe(cantidad);
    expect(ctx.piezas).toEqual(["L", "A", "triangulo"].map((sourcePieceId) => ({
      sourcePieceId,
      cantidad,
      anchoMm: 300,
      altoMm: 400,
      perimetroMm: 4000 / 3,
    })));
    expect(ctx.piezaAreaTotalM2).toBeCloseTo(0.17 * cantidad);
    expect(ctx.piezaPerimetroTotalM).toBe(4 * cantidad);
    expect(ctx.disenoVectorialCacheKey).toBe("nesting-de-dos-carteles");
  });

  it("ignora también filas de medidas anteriores al cambiar a SVG", () => {
    const config = configVectorial();
    config.piezas = [{ uiKey: "anterior", cantidad: 25, anchoMm: 200, altoMm: 300 }];

    expect(buildJobContext(productoPolyfan(), config, 2, []).cantidad).toBe(2);
  });

  it("mantiene la cantidad del producto al estimar por placas", () => {
    const config = { ...configVectorial(), modoCotizacionVectorial: "placas" as const };
    const ctx = buildJobContext(productoPolyfan(), config, 2, []);

    expect(ctx.cantidad).toBe(2);
    expect(ctx.piezas).toBeUndefined();
    expect(ctx.disenoVectorialFuente).toBeUndefined();
  });

  it("mantiene la suma por filas cuando se cotiza por medidas rectangulares", () => {
    const producto = productoPolyfan();
    producto.atributosComercialesJson = {
      geometriasComerciales: { version: 1, modo: "AMBAS", fuentes: [] },
    };
    const config = {
      ...configVectorial(),
      modoCotizacionVectorial: "medidas" as const,
      piezas: [{ uiKey: "rectangular", cantidad: 25, anchoMm: 200, altoMm: 300 }],
    };
    const ctx = buildJobContext(producto, config, 2, []);

    expect(ctx.cantidad).toBe(25);
    expect(ctx.piezas).toEqual([{ cantidad: 25, anchoMm: 200, altoMm: 300 }]);
    expect(ctx.disenoVectorialFuente).toBeUndefined();
  });

  it("no confunde el default SVG del estado con una ruta rectangular", () => {
    const producto = productoPolyfan();
    producto.rutasAlternativas[0].configPasos[0].rutaPaso.herramientasCotizacion = [];
    const config = {
      ...DEFAULT_MOTOR_CONFIG,
      piezas: [{ uiKey: "rectangular", cantidad: 25, anchoMm: 200, altoMm: 300 }],
    };

    expect(buildJobContext(producto, config, 2, []).cantidad).toBe(25);
  });
});
