/**
 * Grid 2D multi-size: acomoda piezas de DIFERENTES tamaños en uno o
 * más sustratos `sheet` usando bin-packing 2D (Maximal Rectangles).
 *
 * Si las piezas no entran en un solo sustrato, abre nuevos sustratos
 * automáticamente. Cada placement lleva `substrateIndex` para
 * trazabilidad.
 *
 * Evolucionado desde el algoritmo legacy:
 *   - motors/rigid-printed.calculations.ts:nestMultiMedida
 *
 * Además del encaje MaxRects, compara alternativas para minimizar el material
 * consumido sobre el lado largo de la placa.
 */

import { MaxRectsPacker, PACKING_LOGIC } from 'maxrects-packer';
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

type OrientationStrategy =
  | 'automatic'
  | 'minimize-long-axis-per-piece'
  | 'maximize-long-axis-per-piece';

interface PackingContext {
  areaWidthMm: number;
  areaHeightMm: number;
  sepHMm: number;
  sepVMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
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

export type Grid2DMultiOptions = NestingOptions;

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
  // El solver trabaja siempre en coordenadas canonicas: lado corto en X y
  // lado largo en Y. Si la placa vino declarada al reves (caso MDF 1300x900),
  // transponemos entrada y salida. Asi el acomodo optimiza el mismo eje que
  // despues usan el costeo y los escalones, sin cambiar la orientacion que ve
  // el consumidor del resultado.
  if (substrate.widthMm > substrate.heightMm) {
    const margins = substrate.margins;
    const transposed = nestGrid2DMultiAlongLongYAxis(
      pieces.map((piece) => ({
        ...piece,
        widthMm: piece.heightMm,
        heightMm: piece.widthMm,
      })),
      {
        ...substrate,
        widthMm: substrate.heightMm,
        heightMm: substrate.widthMm,
        margins: margins
          ? {
              leftMm: margins.topMm,
              rightMm: margins.bottomMm,
              topMm: margins.leftMm,
              bottomMm: margins.rightMm,
              startMm: margins.startMm,
              endMm: margins.endMm,
            }
          : undefined,
      },
      {
        ...options,
        separationHMm: options.separationVMm,
        separationVMm: options.separationHMm,
      },
    );
    return {
      ...transposed,
      substrates: transposed.substrates.map((item) =>
        item.kind === 'sheet'
          ? {
              ...item,
              widthMm: item.heightMm,
              heightMm: item.widthMm,
            }
          : item,
      ),
      placements: transposed.placements.map((placement) => ({
        ...placement,
        xMm: placement.yMm,
        yMm: placement.xMm,
        widthMm: placement.heightMm,
        heightMm: placement.widthMm,
      })),
    };
  }

  return nestGrid2DMultiAlongLongYAxis(pieces, substrate, options);
}

function nestGrid2DMultiAlongLongYAxis<T = unknown>(
  pieces: Piece<T>[],
  substrate: SheetSubstrate,
  options: Grid2DMultiOptions,
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

  const context: PackingContext = {
    areaWidthMm,
    areaHeightMm,
    sepHMm,
    sepVMm,
    marginLeftMm,
    marginRightMm,
    marginTopMm,
    marginBottomMm,
  };

  /**
   * MaxRects optimiza el encaje local de cada rectángulo. Eso puede elegir una
   * orientación válida pero consumir más avance sobre el lado largo de la
   * placa. Evaluamos más de una estrategia y elegimos por el objetivo físico:
   * menos placas y, en empate, menos largo total consumido. Los escalones de
   * precio deliberadamente no participan de esta decisión.
   */
  const candidateDefinitions: Array<{
    orientation: OrientationStrategy;
    logic: PACKING_LOGIC;
  }> = [
    { orientation: 'automatic', logic: PACKING_LOGIC.MAX_EDGE },
    { orientation: 'automatic', logic: PACKING_LOGIC.MAX_AREA },
  ];
  if (allowRotation) {
    candidateDefinitions.push(
      {
        orientation: 'minimize-long-axis-per-piece',
        logic: PACKING_LOGIC.MAX_EDGE,
      },
      {
        orientation: 'minimize-long-axis-per-piece',
        logic: PACKING_LOGIC.MAX_AREA,
      },
      {
        orientation: 'maximize-long-axis-per-piece',
        logic: PACKING_LOGIC.MAX_EDGE,
      },
      {
        orientation: 'maximize-long-axis-per-piece',
        logic: PACKING_LOGIC.MAX_AREA,
      },
    );
  }

  const candidates = candidateDefinitions.map(({ orientation, logic }) => {
    const pendientes = expandPendingPieces(
      piezasValidas,
      context,
      allowRotation,
      orientation,
    );
    return packPendingPieces<T>(
      pendientes,
      substrate,
      context,
      expectedCount,
      orientation === 'automatic' && allowRotation,
      logic,
    );
  });

  return candidates.reduce((best, candidate) =>
    isBetterMaterialLayout(candidate, best) ? candidate : best,
  );
}

function expandPendingPieces<T>(
  pieces: Piece<T>[],
  context: PackingContext,
  allowRotation: boolean,
  orientation: OrientationStrategy,
): PendingPiece[] {
  const pendientes: PendingPiece[] = [];
  for (const piece of pieces) {
    const entraNormal =
      piece.widthMm <= context.areaWidthMm &&
      piece.heightMm <= context.areaHeightMm;
    const entraRotada =
      allowRotation &&
      piece.heightMm <= context.areaWidthMm &&
      piece.widthMm <= context.areaHeightMm;
    const ambasOrientacionesEntran = entraNormal && entraRotada;
    const prerotated =
      entraRotada &&
      (!entraNormal ||
        (ambasOrientacionesEntran &&
          ((orientation === 'minimize-long-axis-per-piece' &&
            piece.widthMm < piece.heightMm) ||
            (orientation === 'maximize-long-axis-per-piece' &&
              piece.widthMm > piece.heightMm))));

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

  // Orden estable y determinista: área descendente y luego lado mayor.
  pendientes.sort(
    (a, b) =>
      b.origW * b.origH - a.origW * a.origH ||
      Math.max(b.origW, b.origH) - Math.max(a.origW, a.origH),
  );
  return pendientes;
}

function packPendingPieces<T>(
  pendientes: PendingPiece[],
  substrate: SheetSubstrate,
  context: PackingContext,
  expectedCount: number,
  packerCanRotate: boolean,
  logic: PACKING_LOGIC,
): Grid2DMultiResult<T> {
  if (pendientes.length === 0) return emptyResult<T>();

  const packer = new MaxRectsPacker(
    context.areaWidthMm + context.sepHMm,
    context.areaHeightMm + context.sepVMm,
    0,
    {
      smart: false,
      pot: false,
      square: false,
      allowRotation: packerCanRotate,
      logic,
    },
  );

  for (const p of pendientes) {
    // MaxRects conserva el orden en que genera sus rectángulos libres y, ante
    // un empate de score, suele probar primero el hueco inferior. Ordenarlos
    // por Y hace que complete antes el ancho disponible de la placa y evita
    // avanzar innecesariamente sobre su lado largo.
    for (const bin of packer.bins) {
      bin.freeRects.sort((a, b) => a.y - b.y || a.x - b.x);
    }
    packer.add(p.packedW + context.sepHMm, p.packedH + context.sepVMm, p);
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
      const bottom = rect.y + placedH + context.marginTopMm;
      if (bottom > maxYLocal) maxYLocal = bottom;
      placements.push({
        pieceId: data.pieceId,
        substrateIndex: binIndex,
        xMm: context.marginLeftMm + rect.x,
        yMm: context.marginTopMm + rect.y,
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
      consumedLengthMm: maxYLocal > 0 ? maxYLocal + context.marginBottomMm : 0,
    });
    totalAreaUtil += areaUtil;
  });

  const EPSILON_MM = 0.01;
  const hayPlacementInvalido =
    placements.length !== expectedCount ||
    placements.some(
      (placement) =>
        placement.xMm < context.marginLeftMm - EPSILON_MM ||
        placement.yMm < context.marginTopMm - EPSILON_MM ||
        placement.xMm + placement.widthMm >
          substrate.widthMm - context.marginRightMm + EPSILON_MM ||
        placement.yMm + placement.heightMm >
          substrate.heightMm - context.marginBottomMm + EPSILON_MM,
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
      trailingMarginMm: context.marginBottomMm,
      perSubstrate,
    },
    perSubstrate,
  };
}

function isBetterMaterialLayout<T>(
  candidate: Grid2DMultiResult<T>,
  current: Grid2DMultiResult<T>,
): boolean {
  if (candidate.substrates.length !== current.substrates.length) {
    return candidate.substrates.length < current.substrates.length;
  }

  const candidateConsumed = candidate.perSubstrate.reduce(
    (total, item) => total + item.consumedLengthMm,
    0,
  );
  const currentConsumed = current.perSubstrate.reduce(
    (total, item) => total + item.consumedLengthMm,
    0,
  );
  if (candidateConsumed !== currentConsumed) {
    return candidateConsumed < currentConsumed;
  }

  const candidateMax = Math.max(
    0,
    ...candidate.perSubstrate.map((item) => item.consumedLengthMm),
  );
  const currentMax = Math.max(
    0,
    ...current.perSubstrate.map((item) => item.consumedLengthMm),
  );
  return candidateMax < currentMax;
}
