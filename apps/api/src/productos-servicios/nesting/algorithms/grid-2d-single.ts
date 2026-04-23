/**
 * Grid 2D single-size: acomoda N copias de UNA pieza en un sustrato
 * tipo `sheet` (placa rígida o pliego de papel) en grilla rectangular,
 * con opción de rotación 90°.
 *
 * Ported (1:1, sin cambios de comportamiento) desde:
 *   - motors/rigid-printed.calculations.ts:nestRectangularGrid
 *
 * El algoritmo:
 *  1. Calcula el área útil descontando márgenes.
 *  2. Calcula columnas/filas en orientación original.
 *  3. Si `allowRotation`, calcula también orientación rotada 90°.
 *  4. Elige la orientación que MAXIMIZA piezas por sustrato.
 *  5. Genera placements (top-left de cada pieza).
 *  6. Calcula métricas: aprovechamiento, largo consumido, áreas.
 *
 * Outputs idénticos al algoritmo legacy (validado por
 * `motors/__tests__/nesting-baseline.spec.ts`).
 */

import type {
  Piece,
  SheetSubstrate,
  NestingOptions,
  NestingResult,
  Placement,
} from '../types';

interface GridDimensions {
  columnas: number;
  filas: number;
}

function calcGrid(
  pieceWidthMm: number,
  pieceHeightMm: number,
  areaWidthMm: number,
  areaHeightMm: number,
  sepHMm: number,
  sepVMm: number,
): GridDimensions {
  if (areaWidthMm < pieceWidthMm || areaHeightMm < pieceHeightMm) {
    return { columnas: 0, filas: 0 };
  }
  return {
    columnas: Math.max(0, Math.floor((areaWidthMm + sepHMm) / (pieceWidthMm + sepHMm))),
    filas: Math.max(0, Math.floor((areaHeightMm + sepVMm) / (pieceHeightMm + sepVMm))),
  };
}

export function nestGrid2DSingle<T = unknown>(
  piece: Piece<T>,
  substrate: SheetSubstrate,
  options: NestingOptions = {},
): NestingResult<T> {
  const sepHMm = options.separationHMm ?? 0;
  const sepVMm = options.separationVMm ?? 0;
  const allowRotation = options.allowRotation ?? false;

  // Margen uniforme legacy: el código original usa `margenMm` único.
  // Lo reconstruimos del shape `Margins` priorizando left/top/right/bottom y,
  // si todos coinciden, lo tratamos como margen uniforme. Si no, usamos
  // left+top como (left, top) y right+bottom como (right, bottom).
  const m = substrate.margins ?? {};
  const marginLeftMm = m.leftMm ?? 0;
  const marginRightMm = m.rightMm ?? marginLeftMm;
  const marginTopMm = m.topMm ?? 0;
  const marginBottomMm = m.bottomMm ?? marginTopMm;

  const areaWidthMm = substrate.widthMm - marginLeftMm - marginRightMm;
  const areaHeightMm = substrate.heightMm - marginTopMm - marginBottomMm;

  const orig = calcGrid(piece.widthMm, piece.heightMm, areaWidthMm, areaHeightMm, sepHMm, sepVMm);
  const origCount = orig.columnas * orig.filas;

  let rot: GridDimensions = { columnas: 0, filas: 0 };
  let rotCount = 0;
  if (allowRotation && piece.widthMm !== piece.heightMm) {
    rot = calcGrid(piece.heightMm, piece.widthMm, areaWidthMm, areaHeightMm, sepHMm, sepVMm);
    rotCount = rot.columnas * rot.filas;
  }

  const useRotated = rotCount > origCount;
  const best = useRotated ? rot : orig;
  const placedWidthMm = useRotated ? piece.heightMm : piece.widthMm;
  const placedHeightMm = useRotated ? piece.widthMm : piece.heightMm;
  const count = best.columnas * best.filas;

  const placements: Placement<T>[] = [];
  for (let row = 0; row < best.filas; row++) {
    for (let col = 0; col < best.columnas; col++) {
      placements.push({
        pieceId: piece.id,
        xMm: marginLeftMm + col * (placedWidthMm + sepHMm),
        yMm: marginTopMm + row * (placedHeightMm + sepVMm),
        widthMm: placedWidthMm,
        heightMm: placedHeightMm,
        rotated: useRotated,
        meta: piece.meta,
      });
    }
  }

  const areaTotalMm2 = substrate.widthMm * substrate.heightMm;
  const areaUtilMm2 = count * piece.widthMm * piece.heightMm;
  const aprovechamientoPct = areaTotalMm2 > 0
    ? Math.round((areaUtilMm2 / areaTotalMm2) * 10000) / 100
    : 0;

  // Largo consumido: legacy lo calcula como margen + filas × altura + (filas-1) × sep + margen
  // Esto es el "alto efectivo" que usa la pieza, útil para costeo `largo_consumido`.
  // Mantiene la fórmula exacta del código legacy (margen uniforme top+bottom).
  const marginVUniformMm = marginTopMm; // legacy usa el mismo margen para top y bottom
  const largoConsumidoMm = best.filas > 0
    ? marginVUniformMm + best.filas * placedHeightMm + (best.filas - 1) * sepVMm + (m.bottomMm ?? marginTopMm)
    : 0;

  return {
    algorithm: 'grid-2d-single',
    substrates: [
      {
        kind: 'sheet',
        count: 1,
        widthMm: substrate.widthMm,
        heightMm: substrate.heightMm,
      },
    ],
    placements,
    metrics: {
      columnas: best.columnas,
      filas: best.filas,
      rotada: useRotated,
      piezasPorSustrato: count,
      aprovechamientoPct,
      areaUtilMm2,
      areaTotalMm2,
      largoConsumidoMm,
    },
  };
}
