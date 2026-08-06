/**
 * MaxRects para rollo flexible.
 *
 * Acomoda piezas mixtas en un rollo de ancho fijo buscando minimizar el largo
 * consumido. Conserva el shape legacy de gran formato para que el dispatcher y
 * el viewer no necesiten ramas nuevas.
 */

import { MaxRectsPacker } from 'maxrects-packer';

import {
  buildGranFormatoManualPieces,
  buildGranFormatoPanelizedPieces,
  buildGranFormatoPieceInstances,
  normalizeGranFormatoPanelManualLayout,
  type GranFormatoPanelAxis,
  type GranFormatoPanelAxisInput,
  type GranFormatoPiece,
} from '../helpers/granformato-pieces';
import {
  buildGranFormatoPieceLabelCm,
  buildGranFormatoNestingOrientacion,
  countGranFormatoRowsAndPiecesPerRow,
  MAX_PIEZAS_BUSQUEDA_EXHAUSTIVA,
  type EvaluateGranFormatoMixedShelfLayoutInput,
  type GranFormatoCostosPreviewPlacement,
  type GranFormatoMixedShelfLayoutResult,
} from './shelf-rollo';

type PackedRectData = {
  piece: GranFormatoPiece;
  /** La pieza se agregó al packer ya rotada (solo entraba rotada al ancho). */
  prerotated?: boolean;
};

function resolvePanelAxisSummary(
  configuredAxis: GranFormatoPanelAxisInput,
  placements: GranFormatoCostosPreviewPlacement[],
): GranFormatoPanelAxisInput | null {
  const axes = new Set(
    placements
      .map((placement) => placement.panelAxis)
      .filter((axis): axis is GranFormatoPanelAxis => axis != null),
  );
  if (axes.size === 0) return null;
  if (axes.size === 1) return [...axes][0];
  return configuredAxis === 'automatic' ? 'automatic' : [...axes][0];
}

function buildPieces(
  input: EvaluateGranFormatoMixedShelfLayoutInput,
): GranFormatoPiece[] | null {
  const manualLayout = normalizeGranFormatoPanelManualLayout(
    input.panelizado?.manualLayout ?? null,
  );
  return input.panelizado?.activo
    ? input.panelizado.mode === 'manual' && manualLayout
      ? buildGranFormatoManualPieces({
          medidas: input.medidas,
          printableWidthMm: input.printableWidthMm,
          maxPanelWidthMm: input.panelizado.maxPanelWidthMm,
          widthInterpretation: input.panelizado.widthInterpretation,
          manualLayout,
        })
      : buildGranFormatoPanelizedPieces({
          medidas: input.medidas,
          printableWidthMm: input.printableWidthMm,
          allowRotation: input.permitirRotacion,
          panelAxis: input.panelizado.axis,
          overlapMm: input.panelizado.overlapMm,
          maxPanelWidthMm: input.panelizado.maxPanelWidthMm,
          distribution: input.panelizado.distribution,
          widthInterpretation: input.panelizado.widthInterpretation,
        })
    : buildGranFormatoPieceInstances(input.medidas);
}

function uniquePieceOrders(pieces: GranFormatoPiece[]): GranFormatoPiece[][] {
  const orders = [
    pieces,
    [...pieces].sort((a, b) => b.area - a.area),
    [...pieces].sort(
      (a, b) => b.widthMm - a.widthMm || b.heightMm - a.heightMm,
    ),
    [...pieces].sort(
      (a, b) => b.heightMm - a.heightMm || b.widthMm - a.widthMm,
    ),
    [...pieces].sort(
      (a, b) => b.shortestSide - a.shortestSide || b.area - a.area,
    ),
  ];
  const seen = new Set<string>();
  return orders.filter((order) => {
    const key = order.map((piece) => piece.id).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toPlacement(
  piece: GranFormatoPiece,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  rotated: boolean,
): GranFormatoCostosPreviewPlacement {
  return {
    id: piece.id,
    widthMm,
    heightMm,
    centerXMm: xMm + widthMm / 2,
    centerYMm: yMm + heightMm / 2,
    label: buildGranFormatoPieceLabelCm(
      piece.originalWidthMm,
      piece.originalHeightMm,
    ),
    rotated,
    originalWidthMm: piece.originalWidthMm,
    originalHeightMm: piece.originalHeightMm,
    panelIndex: piece.panelIndex,
    panelCount: piece.panelCount,
    panelAxis: piece.panelAxis,
    sourcePieceId: piece.sourcePieceId,
    usefulWidthMm: piece.usefulWidthMm ?? piece.widthMm,
    usefulHeightMm: piece.usefulHeightMm ?? piece.heightMm,
    overlapStartMm: piece.overlapStartMm ?? 0,
    overlapEndMm: piece.overlapEndMm ?? 0,
  };
}

function packAtContentHeight(
  input: EvaluateGranFormatoMixedShelfLayoutInput,
  orderedPieces: GranFormatoPiece[],
  contentHeightMm: number,
): GranFormatoCostosPreviewPlacement[] | null {
  if (contentHeightMm <= 0) return null;

  // El rollo acota el ANCHO (printableWidthMm); el largo es libre. Una pieza
  // solo entra si alguno de sus lados (el menor, si se permite rotar) cabe en
  // el ancho útil. Sin este chequeo el packer podía ubicar piezas con overflow
  // (aprovechamiento > 100%) en vez de rechazarlas.
  for (const piece of orderedPieces) {
    const ladoQueCruzaElAncho = input.permitirRotacion
      ? Math.min(piece.widthMm, piece.heightMm)
      : piece.widthMm;
    if (ladoQueCruzaElAncho > input.printableWidthMm) return null;
  }

  const packer = new MaxRectsPacker(
    input.printableWidthMm + input.separacionHorizontalMm,
    contentHeightMm + input.separacionVerticalMm,
    0,
    {
      smart: true,
      pot: false,
      square: false,
      allowRotation: input.permitirRotacion,
    },
  );

  for (const piece of orderedPieces) {
    if (piece.widthMm <= 0 || piece.heightMm <= 0) continue;
    // La librería marca un rect como "oversized" si su ancho sin rotar excede
    // el bin, SIN intentar la rotación. Las piezas que solo entran rotadas al
    // ancho las agregamos ya rotadas nosotros.
    const prerotated =
      input.permitirRotacion &&
      piece.widthMm > input.printableWidthMm &&
      piece.heightMm <= input.printableWidthMm;
    const addWidthMm = prerotated ? piece.heightMm : piece.widthMm;
    const addHeightMm = prerotated ? piece.widthMm : piece.heightMm;
    packer.add(
      addWidthMm + input.separacionHorizontalMm,
      addHeightMm + input.separacionVerticalMm,
      { piece, prerotated } satisfies PackedRectData,
    );
  }

  if (packer.bins.length !== 1) return null;
  const rects = packer.bins[0]?.rects ?? [];
  if (rects.length !== orderedPieces.length) return null;

  const placements = rects.map((rect) => {
    const packed = rect as unknown as {
      x: number;
      y: number;
      width: number;
      height: number;
      rot?: boolean;
      data?: PackedRectData;
    };
    const piece = packed.data?.piece;
    if (!piece) return null;
    // Rotación neta = pre-rotación nuestra XOR rotación del packer. Usamos las
    // dims reales de la pieza (no las del rect, que arrastran separaciones).
    const rotated = (packed.data?.prerotated === true) !== (packed.rot === true);
    const widthMm = rotated ? piece.heightMm : piece.widthMm;
    const heightMm = rotated ? piece.widthMm : piece.heightMm;
    return toPlacement(
      piece,
      input.marginLeftMm + packed.x,
      input.marginStartMm + packed.y,
      widthMm,
      heightMm,
      rotated,
    );
  });

  if (placements.some((placement) => placement == null)) return null;

  // La librería NO falla cuando un rect no entra en el bin: lo mete en un bin
  // "oversized" sin rotar (ej: pieza 1460×900 en ancho útil 905 pasaba el
  // chequeo previo porque su lado menor entra rotado, pero a esta altura de
  // prueba la rotación tampoco cabía y quedaba colocada con overflow y
  // aprovechamiento > 100%). Validamos que cada placement quede dentro del
  // ancho útil y del largo probado; si no, esta altura no es válida.
  const epsilonMm = 0.01;
  const maxRightMm = input.marginLeftMm + input.printableWidthMm + epsilonMm;
  const maxBottomMm = input.marginStartMm + contentHeightMm + epsilonMm;
  for (const placement of placements as GranFormatoCostosPreviewPlacement[]) {
    if (placement.centerXMm + placement.widthMm / 2 > maxRightMm) return null;
    if (placement.centerYMm + placement.heightMm / 2 > maxBottomMm) return null;
  }

  return placements as GranFormatoCostosPreviewPlacement[];
}

function findBestForOrder(
  input: EvaluateGranFormatoMixedShelfLayoutInput,
  orderedPieces: GranFormatoPiece[],
  lowerContentHeightMm: number,
  upperContentHeightMm: number,
) {
  const coarseStepMm = 25;
  const fineStepMm = 5;
  let firstFit: {
    contentHeightMm: number;
    placements: GranFormatoCostosPreviewPlacement[];
  } | null = null;

  for (
    let height = lowerContentHeightMm;
    height <= upperContentHeightMm;
    height += coarseStepMm
  ) {
    const placements = packAtContentHeight(input, orderedPieces, height);
    if (!placements) continue;
    firstFit = { contentHeightMm: height, placements };
    break;
  }

  if (!firstFit) {
    const placements = packAtContentHeight(
      input,
      orderedPieces,
      upperContentHeightMm,
    );
    if (!placements) return null;
    firstFit = { contentHeightMm: upperContentHeightMm, placements };
  }

  let best = firstFit;
  const refineStart = Math.max(
    lowerContentHeightMm,
    firstFit.contentHeightMm - coarseStepMm,
  );
  for (
    let height = refineStart;
    height < firstFit.contentHeightMm;
    height += fineStepMm
  ) {
    const placements = packAtContentHeight(input, orderedPieces, height);
    if (!placements) continue;
    best = { contentHeightMm: height, placements };
    break;
  }

  return best;
}

export function evaluateGranFormatoMaxRectsRollLayout(
  input: EvaluateGranFormatoMixedShelfLayoutInput & {
    upperBoundConsumedLengthMm?: number | null;
  },
): GranFormatoMixedShelfLayoutResult | null {
  const pieces = buildPieces(input);
  if (!pieces?.length) return null;
  // A granel el barrido de alturas × packs O(n²) tarda minutos y bloquea el
  // event loop; devolvemos null y el dispatcher se queda con el shelf (que
  // por encima del tope usa su camino greedy O(n·filas)).
  if (pieces.length > MAX_PIEZAS_BUSQUEDA_EXHAUSTIVA) return null;

  const usefulAreaMm2 = input.medidas.reduce(
    (acc, item) => acc + item.anchoMm * item.altoMm * item.cantidad,
    0,
  );
  const maxCandidateHeightMm = pieces.reduce(
    (max, piece) =>
      Math.max(max, piece.heightMm, input.permitirRotacion ? piece.widthMm : 0),
    0,
  );
  const lowerContentHeightMm = Math.max(
    1,
    Math.ceil(usefulAreaMm2 / input.printableWidthMm),
    Math.ceil(maxCandidateHeightMm),
  );
  const fallbackUpper =
    lowerContentHeightMm +
    pieces.reduce((acc, piece) => acc + piece.heightMm, 0) +
    Math.max(0, pieces.length - 1) * input.separacionVerticalMm;
  const upperContentHeightMm = Math.max(
    lowerContentHeightMm,
    Math.ceil(
      (input.upperBoundConsumedLengthMm ?? fallbackUpper) -
        input.marginStartMm -
        input.marginEndMm,
    ),
  );

  const best = uniquePieceOrders(pieces)
    .map((order) =>
      findBestForOrder(
        input,
        order,
        lowerContentHeightMm,
        upperContentHeightMm,
      ),
    )
    .filter(
      (
        result,
      ): result is {
        contentHeightMm: number;
        placements: GranFormatoCostosPreviewPlacement[];
      } => result != null,
    )
    .sort(
      (a, b) =>
        a.contentHeightMm - b.contentHeightMm ||
        wasteProxy(input, a.placements) - wasteProxy(input, b.placements),
    )[0];

  if (!best) return null;

  const maxBottomMm = best.placements.reduce(
    (max, placement) =>
      Math.max(max, placement.centerYMm + placement.heightMm / 2),
    input.marginStartMm,
  );
  const consumedLengthMm = Math.ceil(maxBottomMm + input.marginEndMm);
  const { rows, piecesPerRow } = countGranFormatoRowsAndPiecesPerRow(
    best.placements,
    Math.max(1, input.separacionVerticalMm / 2),
  );

  return {
    orientacion: buildGranFormatoNestingOrientacion(best.placements),
    panelizado: input.panelizado?.activo === true,
    panelAxis: input.panelizado?.activo
      ? resolvePanelAxisSummary(input.panelizado.axis, best.placements)
      : null,
    panelCount: best.placements.reduce(
      (max, item) => Math.max(max, item.panelCount ?? 1),
      1,
    ),
    panelOverlapMm: input.panelizado?.activo
      ? input.panelizado.overlapMm
      : null,
    panelMaxWidthMm: input.panelizado?.activo
      ? input.panelizado.maxPanelWidthMm
      : null,
    panelDistribution: input.panelizado?.activo
      ? input.panelizado.distribution
      : null,
    panelWidthInterpretation: input.panelizado?.activo
      ? input.panelizado.widthInterpretation
      : null,
    panelMode: input.panelizado?.activo ? input.panelizado.mode : null,
    piecesPerRow,
    rows,
    consumedLengthMm,
    usefulAreaM2: usefulAreaMm2 / 1_000_000,
    placements: best.placements,
  };
}

function wasteProxy(
  input: EvaluateGranFormatoMixedShelfLayoutInput,
  placements: GranFormatoCostosPreviewPlacement[],
) {
  const maxBottomMm = placements.reduce(
    (max, placement) =>
      Math.max(max, placement.centerYMm + placement.heightMm / 2),
    input.marginStartMm,
  );
  const contentLengthMm = Math.max(0, maxBottomMm - input.marginStartMm);
  const usefulAreaMm2 = placements.reduce(
    (acc, placement) =>
      acc + placement.originalWidthMm * placement.originalHeightMm,
    0,
  );
  return input.printableWidthMm * contentLengthMm - usefulAreaMm2;
}
