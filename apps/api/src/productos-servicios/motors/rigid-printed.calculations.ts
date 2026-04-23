/**
 * Cálculos del motor Rígidos Impresos.
 *
 * Funciones puras (sin acceso a DB):
 * - Nesting grid rectangular en placa finita
 * - 3 estrategias de costeo del material rígido
 *
 * **2026-04-23 — Fase 1.1 de la abstracción de nesting**:
 * `nestRectangularGrid` y `calcularCosteoMaterial` ahora delegan al
 * módulo `apps/api/src/productos-servicios/nesting/`. Los shapes
 * (NestingInput, NestingResult, CosteoInput, CosteoResult) se mantienen
 * intactos para no romper consumidores. Ver
 * `docs/nesting-abstraccion-diseno.md`.
 */

import type { EstrategiaCosteoMaterial } from './rigid-printed.types';
import {
  nestRectangularGridV2,
  calcularCosteoMaterialV2,
  nestMultiMedidaV2,
} from '../nesting/adapters/rigid-adapter';

// ─── Nesting ─────────────────────────────────────────────────────

export type NestingInput = {
  piezaAnchoMm: number;
  piezaAltoMm: number;
  placaAnchoMm: number;
  placaAltoMm: number;
  separacionHMm: number;
  separacionVMm: number;
  margenMm: number;
  permitirRotacion: boolean;
};

export type NestingPiecePosition = {
  x: number;
  y: number;
  anchoMm: number;
  altoMm: number;
  rotada: boolean;
};

export type NestingResult = {
  piezasPorPlaca: number;
  columnas: number;
  filas: number;
  rotada: boolean;
  posiciones: NestingPiecePosition[];
  aprovechamientoPct: number;
  largoConsumidoMm: number;
  areaUtilMm2: number;
  areaTotalMm2: number;
};

/**
 * Delega a `apps/api/src/productos-servicios/nesting/algorithms/grid-2d-single.ts`
 * vía adapter `nesting/adapters/rigid-adapter.ts`. Mantiene shape legacy.
 */
export function nestRectangularGrid(input: NestingInput): NestingResult {
  return nestRectangularGridV2(input);
}

export function calculatePlatesNeeded(totalPiezas: number, piezasPorPlaca: number) {
  if (piezasPorPlaca <= 0) return { placas: 0, sobrantes: 0 };
  const placas = Math.ceil(totalPiezas / piezasPorPlaca);
  return { placas, sobrantes: placas * piezasPorPlaca - totalPiezas };
}

// ─── Multi-medida bin-packing (Maximal Rectangles) ──────────────

export type MultiMedidaInput = { anchoMm: number; altoMm: number; cantidad: number };

export type MultiMedidaResult = {
  placas: number;
  totalPiezas: number;
  areaUtilMm2: number;
  areaTotalMm2: number;
  aprovechamientoPct: number;
  placaLayouts: Array<{ areaUtilMm2: number; largoConsumidoMm: number }>;
};

/**
 * Delega a `nesting/algorithms/grid-2d-multi.ts` vía adapter
 * `nesting/adapters/rigid-adapter.ts:nestMultiMedidaV2`.
 * Mantiene shape legacy.
 */
export function nestMultiMedida(
  medidas: MultiMedidaInput[],
  placaAnchoMm: number,
  placaAltoMm: number,
  sepH: number,
  sepV: number,
  margen: number,
  permitirRotacion: boolean,
  orientacionPlaca: 'usar_lado_corto' | 'usar_lado_largo' = 'usar_lado_corto',
): MultiMedidaResult {
  return nestMultiMedidaV2(medidas, placaAnchoMm, placaAltoMm, sepH, sepV, margen, permitirRotacion, orientacionPlaca);
}

// ─── Costeo del material rígido ──────────────────────────────────

export type CosteoInput = {
  estrategia: EstrategiaCosteoMaterial;
  /** Precio de una placa completa */
  precioPlaca: number;
  /** Dimensiones de la placa en mm */
  placaAnchoMm: number;
  placaAltoMm: number;
  /** Resultado del nesting */
  nesting: NestingResult;
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
  const { nesting, placasNecesarias, cantidadTotal } = input;
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
    // Largo consumido real usando largoConsumidoMm del nesting result
    const largoConsumido = nesting.largoConsumidoMm > 0
      ? (filasNecesarias / nesting.filas) * nesting.largoConsumidoMm
      : filasNecesarias * pH;
    // Se cobra proporción del largo consumido sobre largo total de placa
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
 *
 * 2026-04-23: delega a `nesting/adapters/rigid-adapter.ts` →
 * `nesting/costing/applyCostingStrategy`. Mantiene shape legacy
 * (CosteoInput → CosteoResult). Las 3 funciones internas
 * (costeoM2Exacto, costeoLargoConsumido, costeoSegmentosPlaca) se
 * conservan momentáneamente para no romper imports externos pero
 * NO se invocan más desde acá. Quedarán deprecadas en Fase 2.
 */
export function calcularCosteoMaterial(input: CosteoInput): CosteoResult {
  return calcularCosteoMaterialV2(input);
}

// ─── Helpers ─────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
