/**
 * Cálculos del motor Rígidos Impresos.
 *
 * Funciones puras (sin acceso a DB):
 * - Nesting grid rectangular en placa finita
 * - 3 estrategias de costeo del material rígido
 */

import { MaxRectsPacker } from 'maxrects-packer';
import type { EstrategiaCosteoMaterial } from './rigid-printed.types';

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

function calcGrid(
  piezaW: number, piezaH: number,
  areaW: number, areaH: number,
  sepH: number, sepV: number,
) {
  if (areaW < piezaW || areaH < piezaH) return { columnas: 0, filas: 0 };
  return {
    columnas: Math.max(0, Math.floor((areaW + sepH) / (piezaW + sepH))),
    filas: Math.max(0, Math.floor((areaH + sepV) / (piezaH + sepV))),
  };
}

export function nestRectangularGrid(input: NestingInput): NestingResult {
  const { piezaAnchoMm, piezaAltoMm, placaAnchoMm, placaAltoMm, separacionHMm, separacionVMm, margenMm, permitirRotacion } = input;
  const areaW = placaAnchoMm - 2 * margenMm;
  const areaH = placaAltoMm - 2 * margenMm;

  const orig = calcGrid(piezaAnchoMm, piezaAltoMm, areaW, areaH, separacionHMm, separacionVMm);
  const origCount = orig.columnas * orig.filas;

  let rot = { columnas: 0, filas: 0 };
  let rotCount = 0;
  if (permitirRotacion && piezaAnchoMm !== piezaAltoMm) {
    rot = calcGrid(piezaAltoMm, piezaAnchoMm, areaW, areaH, separacionHMm, separacionVMm);
    rotCount = rot.columnas * rot.filas;
  }

  const useRot = rotCount > origCount;
  const best = useRot ? rot : orig;
  const pW = useRot ? piezaAltoMm : piezaAnchoMm;
  const pH = useRot ? piezaAnchoMm : piezaAltoMm;
  const count = best.columnas * best.filas;

  const posiciones: NestingPiecePosition[] = [];
  for (let row = 0; row < best.filas; row++) {
    for (let col = 0; col < best.columnas; col++) {
      posiciones.push({
        x: margenMm + col * (pW + separacionHMm),
        y: margenMm + row * (pH + separacionVMm),
        anchoMm: pW,
        altoMm: pH,
        rotada: useRot,
      });
    }
  }

  const areaTotalMm2 = placaAnchoMm * placaAltoMm;
  const areaUtilMm2 = count * piezaAnchoMm * piezaAltoMm;
  const aprovechamientoPct = areaTotalMm2 > 0
    ? Math.round((areaUtilMm2 / areaTotalMm2) * 10000) / 100
    : 0;

  // Largo consumido: desde margen hasta la última fila + pieza
  const largoConsumidoMm = best.filas > 0
    ? margenMm + best.filas * pH + (best.filas - 1) * separacionVMm + margenMm
    : 0;

  return {
    piezasPorPlaca: count,
    columnas: best.columnas,
    filas: best.filas,
    rotada: useRot,
    posiciones,
    aprovechamientoPct,
    largoConsumidoMm,
    areaUtilMm2,
    areaTotalMm2,
  };
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
  type Pieza = { w: number; h: number };
  const areaW = placaAnchoMm - 2 * margen;
  const areaH = placaAltoMm - 2 * margen;

  // Crear lista de piezas, ordenar por área descendente
  const pendientes: Pieza[] = [];
  for (const m of medidas) {
    if (m.anchoMm <= 0 || m.altoMm <= 0 || m.cantidad <= 0) continue;
    for (let i = 0; i < m.cantidad; i++) {
      pendientes.push({ w: m.anchoMm, h: m.altoMm });
    }
  }
  pendientes.sort((a, b) => (b.w * b.h) - (a.w * a.h));

  if (pendientes.length === 0) {
    return { placas: 0, totalPiezas: 0, areaUtilMm2: 0, areaTotalMm2: 0, aprovechamientoPct: 0, placaLayouts: [] };
  }

  // ── Bin-packing 2D con maxrects-packer ──────────────────────────
  const packer = new MaxRectsPacker(areaW + sepH, areaH + sepV, 0, {
    smart: false,  // tamaño fijo de placa
    pot: false,
    square: false,
    allowRotation: permitirRotacion,
  });

  for (const p of pendientes) {
    packer.add(p.w + sepH, p.h + sepV, { origW: p.w, origH: p.h });
  }

  const placaLayouts: MultiMedidaResult['placaLayouts'] = [];
  let totalPiezas = 0;
  let totalAreaUtil = 0;

  for (const bin of packer.bins) {
    let maxY = 0;
    let areaUtil = 0;
    for (const rect of bin.rects) {
      const d = (rect as any).data as { origW: number; origH: number };
      const rotada: boolean = (rect as any).rot ?? false;
      const pieceH = rotada ? d.origW : d.origH;
      const bottom = rect.y + pieceH + margen;
      if (bottom > maxY) maxY = bottom;
      areaUtil += d.origW * d.origH;
    }
    placaLayouts.push({ areaUtilMm2: areaUtil, largoConsumidoMm: maxY > 0 ? margen + maxY : 0 });
    totalPiezas += bin.rects.length;
    totalAreaUtil += areaUtil;
  }

  const areaTotalMm2 = placaAnchoMm * placaAltoMm * placaLayouts.length;
  return {
    placas: placaLayouts.length,
    totalPiezas,
    areaUtilMm2: totalAreaUtil,
    areaTotalMm2,
    aprovechamientoPct: areaTotalMm2 > 0 ? round2((totalAreaUtil / areaTotalMm2) * 100) : 0,
    placaLayouts,
  };
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
