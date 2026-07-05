/**
 * Acomodo secuencial en rollo — para plotter CAD.
 *
 * Los plotter CAD imprimen los planos de a uno: no "juntan" piezas de
 * distintos archivos en el ancho del rollo para optimizar. Cada pieza (cada
 * plano / fila de medida) ocupa su propia fila; la única optimización posible
 * es la orientación (horizontal o vertical) para reducir el largo consumido.
 *
 * Conserva el shape de resultado de gran formato para que el dispatcher y el
 * viewer no necesiten ramas nuevas.
 */

import { buildGranFormatoPieceInstances } from '../helpers/granformato-pieces';
import {
  buildGranFormatoNestingOrientacion,
  buildGranFormatoPieceLabelCm,
  type EvaluateGranFormatoMixedShelfLayoutInput,
  type GranFormatoCostosPreviewPlacement,
  type GranFormatoMixedShelfLayoutResult,
} from './shelf-rollo';

export function evaluateGranFormatoSequentialRollLayout(
  input: EvaluateGranFormatoMixedShelfLayoutInput,
): GranFormatoMixedShelfLayoutResult | null {
  // Sin panelizado: un plano CAD se imprime a escala, no se puede partir.
  const pieces = buildGranFormatoPieceInstances(input.medidas);
  if (!pieces?.length) return null;

  const placements: GranFormatoCostosPreviewPlacement[] = [];
  let cursorYMm = input.marginStartMm;

  for (const [index, piece] of pieces.entries()) {
    // Orientaciones que entran en el ancho útil; elegimos la de menor alto
    // (menor largo consumido). Si ninguna entra, el rollo no sirve para este
    // plano y devolvemos null (el motor sigue con su fallback).
    const orientations = [
      { widthMm: piece.widthMm, heightMm: piece.heightMm, rotated: false },
      ...(input.permitirRotacion && piece.widthMm !== piece.heightMm
        ? [{ widthMm: piece.heightMm, heightMm: piece.widthMm, rotated: true }]
        : []),
    ].filter((option) => option.widthMm <= input.printableWidthMm);
    const option = orientations.sort((a, b) => a.heightMm - b.heightMm)[0];
    if (!option) return null;

    if (index > 0) cursorYMm += input.separacionVerticalMm;
    placements.push({
      id: piece.id,
      widthMm: option.widthMm,
      heightMm: option.heightMm,
      centerXMm: input.marginLeftMm + option.widthMm / 2,
      centerYMm: cursorYMm + option.heightMm / 2,
      label: buildGranFormatoPieceLabelCm(
        piece.originalWidthMm,
        piece.originalHeightMm,
      ),
      rotated: option.rotated,
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
    });
    cursorYMm += option.heightMm;
  }

  const consumedLengthMm = Math.ceil(cursorYMm + input.marginEndMm);
  const usefulAreaMm2 = input.medidas.reduce(
    (acc, item) => acc + item.anchoMm * item.altoMm * item.cantidad,
    0,
  );

  return {
    orientacion: buildGranFormatoNestingOrientacion(placements),
    panelizado: false,
    panelAxis: null,
    panelCount: 1,
    panelOverlapMm: null,
    panelMaxWidthMm: null,
    panelDistribution: null,
    panelWidthInterpretation: null,
    panelMode: null,
    piecesPerRow: 1,
    rows: placements.length,
    consumedLengthMm,
    usefulAreaM2: usefulAreaMm2 / 1_000_000,
    placements,
  };
}
