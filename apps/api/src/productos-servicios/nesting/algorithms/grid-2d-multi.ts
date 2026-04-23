/**
 * Grid 2D multi-size: acomoda piezas de DIFERENTES tamaños en uno o
 * más sustratos `sheet` usando bin-packing 2D (Maximal Rectangles).
 *
 * Si las piezas no entran en un solo sustrato, abre nuevos sustratos
 * automáticamente. Cada placement lleva `substrateIndex` para
 * trazabilidad.
 *
 * Ported (1:1, sin cambios de comportamiento) desde:
 *   - motors/rigid-printed.calculations.ts:nestMultiMedida
 */

import { MaxRectsPacker } from 'maxrects-packer';
import type {
  Piece,
  SheetSubstrate,
  NestingOptions,
  NestingResult,
  Placement,
  SubstrateUsage,
} from '../types';

interface PendingPiece {
  origW: number;
  origH: number;
  pieceId: string;
  meta?: unknown;
}

export interface Grid2DMultiOptions extends NestingOptions {
  /**
   * Hoy no se usa activamente pero el legacy lo aceptaba como parámetro.
   * Se mantiene en el shape para parity de signature.
   */
  orientacionPlaca?: 'usar_lado_corto' | 'usar_lado_largo';
}

/**
 * Estructura interna que también devolvemos para que el adapter pueda
 * reconstruir `placaLayouts` legacy (areaUtilMm2 + largoConsumidoMm
 * por bin).
 */
export interface Grid2DMultiResult<T = unknown> extends NestingResult<T> {
  perSubstrate: Array<{ areaUtilMm2: number; consumedLengthMm: number }>;
}

export function nestGrid2DMulti<T = unknown>(
  pieces: Piece<T>[],
  substrate: SheetSubstrate,
  options: Grid2DMultiOptions = {},
): Grid2DMultiResult<T> {
  const sepHMm = options.separationHMm ?? 0;
  const sepVMm = options.separationVMm ?? 0;
  const allowRotation = options.allowRotation ?? false;
  const m = substrate.margins ?? {};
  const marginUniformMm = m.leftMm ?? m.topMm ?? 0;

  const areaWidthMm = substrate.widthMm - 2 * marginUniformMm;
  const areaHeightMm = substrate.heightMm - 2 * marginUniformMm;

  // Expandir piezas a instancias individuales (1 por cantidad)
  const pendientes: PendingPiece[] = [];
  for (const piece of pieces) {
    if (piece.widthMm <= 0 || piece.heightMm <= 0 || piece.quantity <= 0) continue;
    for (let i = 0; i < piece.quantity; i++) {
      pendientes.push({
        origW: piece.widthMm,
        origH: piece.heightMm,
        pieceId: piece.id,
        meta: piece.meta,
      });
    }
  }
  // Ordenar por área descendente (heurística estándar de bin-packing)
  pendientes.sort((a, b) => (b.origW * b.origH) - (a.origW * a.origH));

  if (pendientes.length === 0) {
    return {
      algorithm: 'grid-2d-multi',
      substrates: [],
      placements: [],
      metrics: {
        aprovechamientoPct: 0,
        areaUtilMm2: 0,
        areaTotalMm2: 0,
      },
      perSubstrate: [],
    };
  }

  const packer = new MaxRectsPacker(areaWidthMm + sepHMm, areaHeightMm + sepVMm, 0, {
    smart: false,
    pot: false,
    square: false,
    allowRotation,
  });

  for (const p of pendientes) {
    packer.add(p.origW + sepHMm, p.origH + sepVMm, {
      origW: p.origW,
      origH: p.origH,
      pieceId: p.pieceId,
      meta: p.meta,
    });
  }

  const placements: Placement<T>[] = [];
  const substrates: SubstrateUsage[] = [];
  const perSubstrate: Array<{ areaUtilMm2: number; consumedLengthMm: number }> = [];
  let totalAreaUtil = 0;

  packer.bins.forEach((bin, binIndex) => {
    let maxYLocal = 0;
    let areaUtil = 0;
    for (const rect of bin.rects) {
      const data = (rect as any).data as {
        origW: number;
        origH: number;
        pieceId: string;
        meta?: T;
      };
      const rotated: boolean = (rect as any).rot ?? false;
      const placedW = rotated ? data.origH : data.origW;
      const placedH = rotated ? data.origW : data.origH;
      const bottom = rect.y + placedH + marginUniformMm;
      if (bottom > maxYLocal) maxYLocal = bottom;
      placements.push({
        pieceId: data.pieceId,
        substrateIndex: binIndex,
        xMm: marginUniformMm + rect.x,
        yMm: marginUniformMm + rect.y,
        widthMm: placedW,
        heightMm: placedH,
        rotated,
        meta: data.meta,
      });
      areaUtil += data.origW * data.origH;
    }
    substrates.push({
      kind: 'sheet',
      count: 1,
      widthMm: substrate.widthMm,
      heightMm: substrate.heightMm,
    });
    perSubstrate.push({
      areaUtilMm2: areaUtil,
      consumedLengthMm: maxYLocal > 0 ? marginUniformMm + maxYLocal : 0,
    });
    totalAreaUtil += areaUtil;
  });

  const areaTotalMm2 = substrate.widthMm * substrate.heightMm * substrates.length;
  const aprovechamientoPct = areaTotalMm2 > 0
    ? Math.round((totalAreaUtil / areaTotalMm2) * 10000) / 100
    : 0;

  return {
    algorithm: 'grid-2d-multi',
    substrates,
    placements,
    metrics: {
      aprovechamientoPct,
      areaUtilMm2: totalAreaUtil,
      areaTotalMm2,
    },
    perSubstrate,
  };
}
