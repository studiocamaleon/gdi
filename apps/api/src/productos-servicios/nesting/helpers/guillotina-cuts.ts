/**
 * Cantidad de cortes de guillotina necesarios para separar las piezas
 * de un pliego según la imposición.
 *
 * Reglas:
 *  - `tipoCorte = sin_corte` o `troquelado`: 0 cortes (no usa guillotina).
 *  - Con demasía o `tipoCorte = con_demasia`: 2×cols + 2×rows
 *    (cada pieza tiene cortes a ambos lados de cada eje).
 *  - Sin demasía: cols + rows + 2 (un corte para separar columnas, uno
 *    para filas, +2 cortes perimetrales).
 *
 * Ported (1:1) desde:
 *   productos-servicios.service.ts:calculateGuillotinaCutsFromImposicion
 */

export type GuillotinaCutsInput = {
  cols: number;
  rows: number;
  tipoCorte?: string;
  demasiaCorteMm?: number;
};

export function calculateGuillotinaCutsFromImposicion(input: GuillotinaCutsInput): number {
  const cols = Math.max(0, Math.floor(input.cols));
  const rows = Math.max(0, Math.floor(input.rows));
  if (cols <= 0 || rows <= 0) {
    return 0;
  }
  const rawTipoCorte = String(input.tipoCorte ?? 'guillotina').trim().toLowerCase();
  if (rawTipoCorte === 'sin_corte' || rawTipoCorte === 'troquelado') {
    return 0;
  }
  if (rawTipoCorte === 'con_demasia' || (input.demasiaCorteMm ?? 0) > 0) {
    return cols * 2 + rows * 2;
  }
  return cols + rows + 2;
}
