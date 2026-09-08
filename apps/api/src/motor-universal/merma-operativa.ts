import type { NestingDispatchResult } from './nesting-dispatcher';
import type { PasoCargado } from './tipos';

export interface DesgloseMermaOperativa {
  porcentaje: number;
  cantidadTrabajo: number;
  cantidadMerma: number;
  cantidadTotal: number;
}

/**
 * La merma adicional del sustrato principal representa pérdida operativa del
 * paso (arranque, pruebas o impresiones rechazadas), no el vacío geométrico
 * que deja el nesting. Sólo los consumidores del proceso de impresión deben
 * heredarla.
 */
export function porcentajeMermaOperativaImpresion(
  paso: Pick<PasoCargado, 'slots'>,
): number {
  const sustrato = (paso.slots ?? []).find(
    (slot) => slot.slotCodigo === 'sustrato_principal',
  );
  const porcentaje = Number(sustrato?.mermaAdicionalPct ?? 0);
  return Number.isFinite(porcentaje) && porcentaje > 0 ? porcentaje : 0;
}

export function desglosarMermaOperativa(
  cantidadTrabajo: number,
  porcentaje: number,
): DesgloseMermaOperativa {
  const trabajo =
    Number.isFinite(cantidadTrabajo) && cantidadTrabajo > 0
      ? cantidadTrabajo
      : 0;
  const pct = Number.isFinite(porcentaje) && porcentaje > 0 ? porcentaje : 0;
  const cantidadMerma = trabajo * (pct / 100);
  return {
    porcentaje: pct,
    cantidadTrabajo: trabajo,
    cantidadMerma,
    cantidadTotal: trabajo + cantidadMerma,
  };
}

/**
 * Área que realmente recibe tinta. Los sustratos describen material comprado
 * o recorrido y, por lo tanto, incluyen márgenes y retazos vacíos. La tinta
 * sigue la demanda/los placements, cuyas medidas ya incluyen la demasía del
 * nesting cuando corresponde.
 */
export function areaImpresaTrabajoDesdeNestingM2(
  nesting: NestingDispatchResult,
  cantidadSolicitada: number,
): number {
  if (nesting.demandaRectangular?.length) {
    return (
      nesting.demandaRectangular.reduce(
        (total, pieza) => total + pieza.anchoMm * pieza.altoMm * pieza.cantidad,
        0,
      ) / 1_000_000
    );
  }

  const areaUtilMm2 = Number(nesting.metricasRaw.areaUtilMm2 ?? 0);
  if (!(areaUtilMm2 > 0)) return 0;

  // grid-2d-single conserva una plantilla completa para el visor: sus
  // placements son la capacidad de UN pliego, no la demanda del trabajo.
  // Escalamos el área de una pieza por la cantidad solicitada.
  if (nesting.algorithm === 'grid-2d-single') {
    const piezasPlantilla = Number(
      nesting.piezasPorPliego ?? nesting.metricasRaw.piezasPorSustrato ?? 0,
    );
    if (piezasPlantilla > 0 && cantidadSolicitada > 0) {
      return (areaUtilMm2 / piezasPlantilla / 1_000_000) * cantidadSolicitada;
    }
  }

  // Multi, rollo e irregular publican todos los placements reales.
  return areaUtilMm2 / 1_000_000;
}
