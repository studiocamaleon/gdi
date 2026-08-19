/**
 * Conversión de sustrato a pliego de impresión.
 *
 * Cuando el sustrato (ej. placa A3 de papel comprado) es DIFERENTE al
 * pliego de impresión (ej. A4 que usa la máquina), calcula cuántos
 * pliegos se obtienen por sustrato y en qué orientación (normal o
 * rotada).
 *
 * Si las medidas son aproximadamente iguales (incluyendo rotación),
 * retorna `pliegosPorSustrato = 1` y marca `esDerivado = false`.
 *
 * Ported (1:1) desde:
 *   productos-servicios.service.ts:calculateSustratoToPliegoConversion
 */

export type SustratoToPliegoInput = {
  sustrato: { anchoMm: number; altoMm: number };
  pliegoImpresion: { anchoMm: number; altoMm: number };
};

export type SustratoToPliegoResult = {
  esDerivado: boolean;
  pliegosPorSustrato: number;
  orientacion: 'normal' | 'rotada';
};

/** Tolerancia en mm para considerar dos medidas equivalentes. */
const TOLERANCE_MM = 0.01;

export function approxEqualMm(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE_MM;
}

export function calculateSustratoToPliegoConversion(
  input: SustratoToPliegoInput,
): SustratoToPliegoResult {
  const direct =
    approxEqualMm(input.sustrato.anchoMm, input.pliegoImpresion.anchoMm) &&
    approxEqualMm(input.sustrato.altoMm, input.pliegoImpresion.altoMm);
  const rotatedDirect =
    approxEqualMm(input.sustrato.anchoMm, input.pliegoImpresion.altoMm) &&
    approxEqualMm(input.sustrato.altoMm, input.pliegoImpresion.anchoMm);

  if (direct || rotatedDirect) {
    return {
      esDerivado: false,
      pliegosPorSustrato: 1,
      orientacion: direct ? 'normal' : 'rotada',
    };
  }

  const normalCols = Math.floor(
    input.sustrato.anchoMm / input.pliegoImpresion.anchoMm,
  );
  const normalRows = Math.floor(
    input.sustrato.altoMm / input.pliegoImpresion.altoMm,
  );
  const normal = Math.max(0, normalCols) * Math.max(0, normalRows);

  const rotCols = Math.floor(
    input.sustrato.anchoMm / input.pliegoImpresion.altoMm,
  );
  const rotRows = Math.floor(
    input.sustrato.altoMm / input.pliegoImpresion.anchoMm,
  );
  const rotada = Math.max(0, rotCols) * Math.max(0, rotRows);

  const pliegosPorSustrato = Math.max(normal, rotada);

  return {
    esDerivado: true,
    // Cero es un resultado válido y necesario: significa que el pliego de
    // impresión no puede obtenerse físicamente de la hoja comprada.
    pliegosPorSustrato,
    orientacion: rotada > normal ? 'rotada' : 'normal',
  };
}
