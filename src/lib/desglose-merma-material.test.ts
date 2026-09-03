import { describe, expect, it } from "vitest";

import {
  calcularCostoMermaTiempo,
  calcularDesgloseMermaMaterial,
  calcularItemsMermaMaterial,
} from "@/lib/desglose-merma-material";

describe("calcularDesgloseMermaMaterial", () => {
  it("separa la merma adicional congelada sin alterar el total", () => {
    const resultado = calcularDesgloseMermaMaterial({
      material: {
        cantidad: 11,
        unidad: "m_lineales",
        costoTotal: 1_100,
        mermaAdicional: {
          porcentaje: 10,
          cantidadTrabajo: 10,
          cantidadMerma: 1,
        },
      },
    });

    expect(resultado).toMatchObject({
      origen: "MERMA_ADICIONAL",
      cantidadTrabajo: 10,
      cantidadMerma: 1,
      cantidadTotal: 11,
      costoTrabajo: 1_000,
      costoMerma: 100,
      costoTotal: 1_100,
    });
  });

  it("usa el área costeada real del nesting para mostrar trabajo y merma", () => {
    const resultado = calcularDesgloseMermaMaterial({
      material: {
        cantidad: 0.6,
        unidad: "hoja",
        costoTotal: 4_200,
        detalleCosteoNesting: {},
      },
      costeoNesting: {
        chargedAreaMm2: 700_000,
        wasteAreaMm2: 220_000,
      },
    });

    expect(resultado).not.toBeNull();
    expect(resultado?.cantidadTrabajo).toBeCloseTo(0.48);
    expect(resultado?.cantidadMerma).toBeCloseTo(0.22);
    expect(resultado?.cantidadTotal).toBeCloseTo(0.7);
    expect(resultado!.costoTrabajo + resultado!.costoMerma).toBeCloseTo(4_200);
  });

  it("prorratea el nesting consolidado con la misma asignación del costo", () => {
    const resultado = calcularDesgloseMermaMaterial({
      material: {
        cantidad: 0.3,
        unidad: "hoja",
        costoTotal: 2_100,
        detalleCosteoNesting: {},
      },
      costeoNesting: {
        chargedAreaMm2: 700_000,
        wasteAreaMm2: 220_000,
      },
      porcentajeAsignacion: 50,
      consolidado: true,
    });

    expect(resultado).toMatchObject({ origen: "NESTING_CONSOLIDADO" });
    expect(resultado?.cantidadTrabajo).toBeCloseTo(0.24);
    expect(resultado?.cantidadMerma).toBeCloseTo(0.11);
    expect(resultado?.cantidadTotal).toBeCloseTo(0.35);
  });

  it("suma desperdicio geométrico y merma operativa sin duplicar el costo", () => {
    const resultado = calcularDesgloseMermaMaterial({
      material: {
        cantidad: 1.1,
        unidad: "hoja",
        costoTotal: 1_100,
        detalleCosteoNesting: {},
        mermaAdicional: {
          porcentaje: 10,
          cantidadTrabajo: 1,
          cantidadMerma: 0.1,
        },
      },
      costeoNesting: {
        chargedAreaMm2: 1_000_000,
        wasteAreaMm2: 200_000,
      },
    });

    expect(resultado).toMatchObject({
      origen: "NESTING_Y_MERMA_ADICIONAL",
      costoTotal: 1_100,
    });
    expect(resultado?.cantidadTrabajo).toBeCloseTo(0.8);
    expect(resultado?.cantidadMerma).toBeCloseTo(0.3);
    expect(resultado?.cantidadTotal).toBeCloseTo(1.1);
    expect(resultado?.costoTrabajo).toBeCloseTo(800);
    expect(resultado?.costoMerma).toBeCloseTo(300);
  });

  it("expone nesting y merma operativa como conceptos independientes", () => {
    const items = calcularItemsMermaMaterial({
      material: {
        cantidad: 1.1,
        unidad: "hoja",
        costoTotal: 1_100,
        detalleCosteoNesting: {},
        mermaAdicional: {
          porcentaje: 10,
          cantidadTrabajo: 1,
          cantidadMerma: 0.1,
        },
      },
      costeoNesting: {
        chargedAreaMm2: 1_000_000,
        wasteAreaMm2: 200_000,
      },
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      origen: "NESTING_GEOMETRICA",
      cantidadMerma: 0.2,
      porcentaje: 20,
    });
    expect(items[0].costoMerma).toBeCloseTo(200);
    expect(items[1]).toMatchObject({
      origen: "OPERATIVA",
      cantidadMerma: 0.1,
      porcentaje: 10,
    });
    expect(items[1].costoMerma).toBeCloseTo(100);
  });

  it("prorratea el costo de la corrida de merma sin duplicar el tiempo", () => {
    const costo = calcularCostoMermaTiempo({
      setupMin: 10,
      runMin: 72,
      runTrabajoMin: 60,
      runMermaMin: 12,
      cleanupMin: 5,
      tiempoFijoMin: 0,
      tarifaHora: 6_000,
      costo: 8_700,
    });

    expect(costo).toBeCloseTo(1_200);
  });
});
