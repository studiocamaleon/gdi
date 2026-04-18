/**
 * Cálculos del motor Rígidos Impresos.
 *
 * **C.2.2 — Refactor:** las funciones de nesting se extrajeron a
 * `nesting/nesting-placa-rigida.ts` (modelo universal). Este archivo mantiene:
 *   - Re-exports de las funciones de nesting para compatibilidad backward.
 *   - Las 3 estrategias de costeo del material rígido (NO son nesting,
 *     son reglas de pricing sobre el resultado del nesting).
 */

import type { EstrategiaCosteoMaterial } from './rigid-printed.types';
import {
  nestRectangularGrid,
  nestMultiMedida,
  calculatePlatesNeeded,
  type NestingPlacaInput,
  type NestingPlacaResult,
  type NestingPlacaPlacement,
  type NestingMultiMedidaInput,
  type NestingMultiMedidaResult,
  type NestingMultiMedidaPlacaLayout,
} from '../nesting/nesting-placa-rigida';

// ─── Re-exports backward-compatible ─────────────────────────────

export { nestRectangularGrid, nestMultiMedida, calculatePlatesNeeded };

/** @deprecated Renombrado a NestingPlacaInput; usar el tipo nuevo desde nesting/nesting-placa-rigida. */
export type NestingInput = NestingPlacaInput;
/** @deprecated Renombrado a NestingPlacaPlacement. */
export type NestingPiecePosition = NestingPlacaPlacement;
/** @deprecated Renombrado a NestingPlacaResult. */
export type NestingResult = NestingPlacaResult;
/** @deprecated Renombrado a NestingMultiMedidaInput. */
export type MultiMedidaInput = NestingMultiMedidaInput;
/** @deprecated Renombrado a NestingMultiMedidaResult. */
export type MultiMedidaResult = NestingMultiMedidaResult;
export type MultiMedidaPlacaLayout = NestingMultiMedidaPlacaLayout;

// ─── Costeo del material rígido (NO es nesting, es pricing) ──────

export type CosteoInput = {
  estrategia: EstrategiaCosteoMaterial;
  /** Precio de una placa completa */
  precioPlaca: number;
  /** Dimensiones de la placa en mm */
  placaAnchoMm: number;
  placaAltoMm: number;
  /** Resultado del nesting */
  nesting: NestingPlacaResult;
  /** Cantidad de placas necesarias */
  placasNecesarias: number;
  /** Piezas en la última placa (para segmentos) */
  piezasUltimaPlaca: number;
  /** Escalones de segmentos (ej: [25, 50, 75, 100]) */
  segmentosPlaca: number[];
  /** Cantidad total de piezas */
  cantidadTotal: number;
  /** Dimensiones de pieza en mm */
  piezaAnchoMm: number;
  piezaAltoMm: number;
};

export type CosteoResult = {
  estrategia: EstrategiaCosteoMaterial;
  costoTotal: number;
  detalle: {
    precioPlaca: number;
    precioM2: number;
    placasCompletas: number;
    costoPlacasCompletas: number;
    ultimaPlaca: {
      ocupacionPct: number;
      segmentoAplicado: number | null;
      costo: number;
    } | null;
  };
};

/**
 * Calcula el precio por m2 de la placa.
 */
function precioM2(precioPlaca: number, anchoMm: number, altoMm: number): number {
  const areaM2 = (anchoMm * altoMm) / 1_000_000;
  return areaM2 > 0 ? precioPlaca / areaM2 : 0;
}

/**
 * Estrategia 1: M2 exacto.
 * Se cobra solo el área exacta de las piezas.
 */
function costeoM2Exacto(input: CosteoInput): CosteoResult {
  const pm2 = precioM2(input.precioPlaca, input.placaAnchoMm, input.placaAltoMm);
  const areaPiezasM2 = (input.piezaAnchoMm * input.piezaAltoMm * input.cantidadTotal) / 1_000_000;
  const costoTotal = round2(areaPiezasM2 * pm2);

  return {
    estrategia: 'm2_exacto',
    costoTotal,
    detalle: {
      precioPlaca: input.precioPlaca,
      precioM2: round2(pm2),
      placasCompletas: input.placasNecesarias,
      costoPlacasCompletas: costoTotal,
      ultimaPlaca: null,
    },
  };
}

/**
 * Estrategia 2: Largo consumido (tipo rollo).
 * Se cobra ancho_placa × largo_consumido al precio por m2.
 */
function costeoLargoConsumido(input: CosteoInput): CosteoResult {
  const pm2 = precioM2(input.precioPlaca, input.placaAnchoMm, input.placaAltoMm);
  const { nesting, cantidadTotal } = input;
  const piezasPorPlaca = nesting.piezasPorPlaca;

  // Placas completas (llenas): cobro placa entera
  const placasLlenas = piezasPorPlaca > 0 ? Math.floor(cantidadTotal / piezasPorPlaca) : 0;
  const costoPlacasLlenas = placasLlenas * input.precioPlaca;

  // Última placa parcial: cobro ancho × largo consumido
  const piezasRestantes = cantidadTotal - placasLlenas * piezasPorPlaca;
  let costoUltimaPlaca = 0;
  let ocupacionPct = 0;

  if (piezasRestantes > 0 && nesting.columnas > 0) {
    const pH = nesting.rotada ? input.piezaAnchoMm : input.piezaAltoMm;
    const filasNecesarias = Math.ceil(piezasRestantes / nesting.columnas);
    const largoConsumido = nesting.largoConsumidoMm > 0
      ? (filasNecesarias / nesting.filas) * nesting.largoConsumidoMm
      : filasNecesarias * pH;
    costoUltimaPlaca = round2(input.precioPlaca * (largoConsumido / input.placaAltoMm));
    ocupacionPct = round2((largoConsumido / input.placaAltoMm) * 100);
  }

  return {
    estrategia: 'largo_consumido',
    costoTotal: round2(costoPlacasLlenas + costoUltimaPlaca),
    detalle: {
      precioPlaca: input.precioPlaca,
      precioM2: round2(pm2),
      placasCompletas: placasLlenas,
      costoPlacasCompletas: round2(costoPlacasLlenas),
      ultimaPlaca: piezasRestantes > 0
        ? { ocupacionPct, segmentoAplicado: null, costo: costoUltimaPlaca }
        : null,
    },
  };
}

/**
 * Estrategia 3: Segmentos de placa.
 * Cada placa cobra según el primer escalón ≥ % de ocupación.
 */
function costeoSegmentosPlaca(input: CosteoInput): CosteoResult {
  const { placasNecesarias, cantidadTotal, segmentosPlaca, precioPlaca } = input;
  const piezasPorPlaca = input.nesting.piezasPorPlaca;
  const escalones = segmentosPlaca.length > 0
    ? [...segmentosPlaca].sort((a, b) => a - b)
    : [25, 50, 75, 100];

  if (piezasPorPlaca <= 0) {
    return {
      estrategia: 'segmentos_placa',
      costoTotal: 0,
      detalle: {
        precioPlaca, precioM2: 0, placasCompletas: 0, costoPlacasCompletas: 0, ultimaPlaca: null,
      },
    };
  }

  let costoTotal = 0;
  let placasCompletas = 0;
  let costoPlacasCompletas = 0;
  let ultimaOcupacion = 0;
  let ultimoSegmento = 100;
  let costoUltimaPlaca = 0;

  let piezasRestantes = cantidadTotal;

  for (let i = 0; i < placasNecesarias; i++) {
    const piezasEnEstaPlaca = Math.min(piezasRestantes, piezasPorPlaca);
    piezasRestantes -= piezasEnEstaPlaca;

    const ocupacion = (piezasEnEstaPlaca / piezasPorPlaca) * 100;
    const segmento = escalones.find((s) => s >= ocupacion) ?? 100;
    const costoPlaca = round2(precioPlaca * (segmento / 100));

    costoTotal += costoPlaca;

    if (piezasEnEstaPlaca === piezasPorPlaca) {
      placasCompletas++;
      costoPlacasCompletas += costoPlaca;
    } else {
      ultimaOcupacion = round2(ocupacion);
      ultimoSegmento = segmento;
      costoUltimaPlaca = costoPlaca;
    }
  }

  return {
    estrategia: 'segmentos_placa',
    costoTotal: round2(costoTotal),
    detalle: {
      precioPlaca,
      precioM2: round2(precioM2(precioPlaca, input.placaAnchoMm, input.placaAltoMm)),
      placasCompletas,
      costoPlacasCompletas: round2(costoPlacasCompletas),
      ultimaPlaca: placasNecesarias > placasCompletas
        ? { ocupacionPct: ultimaOcupacion, segmentoAplicado: ultimoSegmento, costo: costoUltimaPlaca }
        : null,
    },
  };
}

/**
 * Calcula el costo del material según la estrategia configurada.
 */
export function calcularCosteoMaterial(input: CosteoInput): CosteoResult {
  switch (input.estrategia) {
    case 'm2_exacto':
      return costeoM2Exacto(input);
    case 'largo_consumido':
      return costeoLargoConsumido(input);
    case 'segmentos_placa':
      return costeoSegmentosPlaca(input);
    default:
      return costeoSegmentosPlaca(input);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
