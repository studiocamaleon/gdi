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
  packedW: number;
  packedH: number;
  prerotated: boolean;
  pieceId: string;
  meta?: unknown;
}

/**
 * El resultado público contiene un placement por pieza, por lo que aun con un
 * packer agrupado terminaríamos materializando todas las instancias. Este
 * límite evita que una entrada accidental tumbe el API por memoria. Los
 * trabajos mayores deben dividirse en tandas antes de llegar al nesting.
 */
export const MAX_GRID_MULTI_INSTANCES = 100_000;

function emptyResult<T>(): Grid2DMultiResult<T> {
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
  const marginLeftMm = m.leftMm ?? 0;
  const marginRightMm = m.rightMm ?? marginLeftMm;
  const marginTopMm = m.topMm ?? 0;
  const marginBottomMm = m.bottomMm ?? marginTopMm;

  const areaWidthMm = substrate.widthMm - marginLeftMm - marginRightMm;
  const areaHeightMm = substrate.heightMm - marginTopMm - marginBottomMm;
  if (areaWidthMm <= 0 || areaHeightMm <= 0) return emptyResult<T>();

  const piezasValidas = pieces.filter(
    (piece) =>
      Number.isFinite(piece.widthMm) &&
      Number.isFinite(piece.heightMm) &&
      Number.isFinite(piece.quantity) &&
      piece.widthMm > 0 &&
      piece.heightMm > 0 &&
      piece.quantity > 0,
  );
  const expectedCount = piezasValidas.reduce(
    (total, piece) => total + Math.ceil(piece.quantity),
    0,
  );
  if (expectedCount <= 0 || expectedCount > MAX_GRID_MULTI_INSTANCES) {
    return emptyResult<T>();
  }

  // maxrects-packer acepta rectángulos "oversized" y los coloca desbordados.
  // Los rechazamos antes de invocarlo: una pieza debe entrar completa en al
  // menos una orientación dentro del área útil.
  const algunaNoEntra = piezasValidas.some((piece) => {
    const normal =
      piece.widthMm <= areaWidthMm && piece.heightMm <= areaHeightMm;
    const rotada =
      allowRotation &&
      piece.heightMm <= areaWidthMm &&
      piece.widthMm <= areaHeightMm;
    return !normal && !rotada;
  });
  if (algunaNoEntra) return emptyResult<T>();

  // Expandir piezas a instancias individuales (1 por cantidad)
  const pendientes: PendingPiece[] = [];
  for (const piece of piezasValidas) {
    const entraNormal =
      piece.widthMm <= areaWidthMm && piece.heightMm <= areaHeightMm;
    const prerotated =
      !entraNormal &&
      allowRotation &&
      piece.heightMm <= areaWidthMm &&
      piece.widthMm <= areaHeightMm;
    for (let i = 0; i < Math.ceil(piece.quantity); i++) {
      pendientes.push({
        origW: piece.widthMm,
        origH: piece.heightMm,
        packedW: prerotated ? piece.heightMm : piece.widthMm,
        packedH: prerotated ? piece.widthMm : piece.heightMm,
        prerotated,
        pieceId: piece.id,
        meta: piece.meta,
      });
    }
  }
  // Ordenar por área descendente (heurística estándar de bin-packing)
  pendientes.sort((a, b) => b.origW * b.origH - a.origW * a.origH);

  if (pendientes.length === 0) return emptyResult<T>();

  const packer = new MaxRectsPacker(
    areaWidthMm + sepHMm,
    areaHeightMm + sepVMm,
    0,
    {
      smart: false,
      pot: false,
      square: false,
      allowRotation,
    },
  );

  for (const p of pendientes) {
    packer.add(p.packedW + sepHMm, p.packedH + sepVMm, {
      origW: p.origW,
      origH: p.origH,
      packedW: p.packedW,
      packedH: p.packedH,
      prerotated: p.prerotated,
      pieceId: p.pieceId,
      meta: p.meta,
    });
  }

  const placements: Placement<T>[] = [];
  const substrates: SubstrateUsage[] = [];
  const perSubstrate: Array<{ areaUtilMm2: number; consumedLengthMm: number }> =
    [];
  let totalAreaUtil = 0;

  packer.bins.forEach((bin, binIndex) => {
    let maxYLocal = 0;
    let areaUtil = 0;
    for (const rect of bin.rects) {
      const packedRect = rect as unknown as {
        data: PendingPiece & { meta?: T };
        rot?: boolean;
      };
      const data = packedRect.data;
      // Una pieza que sólo entra girada se prerota antes de enviarla al
      // packer. Si el packer vuelve a rotarla, ambos giros se cancelan.
      const rotated = data.prerotated !== (packedRect.rot ?? false);
      const placedW = rotated ? data.origH : data.origW;
      const placedH = rotated ? data.origW : data.origH;
      const bottom = rect.y + placedH + marginTopMm;
      if (bottom > maxYLocal) maxYLocal = bottom;
      placements.push({
        pieceId: data.pieceId,
        substrateIndex: binIndex,
        xMm: marginLeftMm + rect.x,
        yMm: marginTopMm + rect.y,
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
      consumedLengthMm: maxYLocal > 0 ? maxYLocal + marginBottomMm : 0,
    });
    totalAreaUtil += areaUtil;
  });

  const EPSILON_MM = 0.01;
  const hayPlacementInvalido =
    placements.length !== expectedCount ||
    placements.some(
      (placement) =>
        placement.xMm < marginLeftMm - EPSILON_MM ||
        placement.yMm < marginTopMm - EPSILON_MM ||
        placement.xMm + placement.widthMm >
          substrate.widthMm - marginRightMm + EPSILON_MM ||
        placement.yMm + placement.heightMm >
          substrate.heightMm - marginBottomMm + EPSILON_MM,
    );
  if (hayPlacementInvalido) return emptyResult<T>();

  const areaTotalMm2 =
    substrate.widthMm * substrate.heightMm * substrates.length;
  const aprovechamientoPct =
    areaTotalMm2 > 0
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
