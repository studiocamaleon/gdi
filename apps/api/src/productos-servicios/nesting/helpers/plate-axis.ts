import type { Placement, SheetSubstrate } from '../types';

export type PlateLongAxis = 'x' | 'y';

type SheetDimensions = Pick<SheetSubstrate, 'widthMm' | 'heightMm'>;
type PlacementDimensions = Pick<
  Placement,
  'xMm' | 'yMm' | 'widthMm' | 'heightMm'
>;

/**
 * Regla fisica unica para placas rectangulares:
 * - el lado mas largo es el eje de avance/consumo;
 * - el lado mas corto es el eje transversal al que son paralelos los escalones.
 *
 * No depende de que el material haya persistido sus lados como ancho/alto o
 * ancho/largo. En placas cuadradas conservamos Y como eje estable.
 */
export function resolvePlateAxes(sheet: SheetDimensions): {
  longAxis: PlateLongAxis;
  longSideMm: number;
  shortSideMm: number;
} {
  const longAxis: PlateLongAxis = sheet.widthMm > sheet.heightMm ? 'x' : 'y';
  return {
    longAxis,
    longSideMm: Math.max(sheet.widthMm, sheet.heightMm),
    shortSideMm: Math.min(sheet.widthMm, sheet.heightMm),
  };
}

export function inferPlateTrailingMarginMm(
  placements: PlacementDimensions[],
  sheet: SheetDimensions,
): number {
  if (placements.length === 0) return 0;
  const { longAxis } = resolvePlateAxes(sheet);
  return placements.reduce(
    (min, placement) =>
      Math.min(min, longAxis === 'x' ? placement.xMm : placement.yMm),
    longAxis === 'x' ? placements[0].xMm : placements[0].yMm,
  );
}

export function consumedLengthAlongPlateLongAxis(args: {
  placements: PlacementDimensions[];
  sheet: SheetDimensions;
  trailingMarginMm?: number | null;
}): number {
  const { placements, sheet } = args;
  if (placements.length === 0) return 0;
  const { longAxis } = resolvePlateAxes(sheet);
  const furthestEdgeMm = placements.reduce(
    (max, placement) =>
      Math.max(
        max,
        longAxis === 'x'
          ? placement.xMm + placement.widthMm
          : placement.yMm + placement.heightMm,
      ),
    0,
  );
  const inferredTrailingMarginMm = inferPlateTrailingMarginMm(
    placements,
    sheet,
  );
  const trailingMarginMm =
    typeof args.trailingMarginMm === 'number' &&
    Number.isFinite(args.trailingMarginMm)
      ? Math.max(0, args.trailingMarginMm)
      : inferredTrailingMarginMm;
  return furthestEdgeMm + trailingMarginMm;
}

/** Rectangulo cobrado: su frontera final siempre es paralela al lado corto. */
export function chargedBoundsAlongPlateLongAxis(
  sheet: SheetDimensions,
  chargedLengthMm: number,
): { xMm: number; yMm: number; widthMm: number; heightMm: number } {
  const { longAxis, longSideMm } = resolvePlateAxes(sheet);
  const boundedLengthMm = Math.min(longSideMm, Math.max(0, chargedLengthMm));
  return longAxis === 'x'
    ? {
        xMm: 0,
        yMm: 0,
        widthMm: boundedLengthMm,
        heightMm: sheet.heightMm,
      }
    : {
        xMm: 0,
        yMm: 0,
        widthMm: sheet.widthMm,
        heightMm: boundedLengthMm,
      };
}
