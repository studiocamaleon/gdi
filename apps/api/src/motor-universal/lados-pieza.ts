/**
 * Lados de una pieza rectangular — vocabulario común de las familias que
 * operan sobre el perímetro: `modificacion_pre` (demasía de bolsillos y
 * refuerzos) y `colocacion_ojales`.
 *
 * Ver `docs/modificaciones-fisicas-lona-diseno.md`.
 */
import type { LadoPieza } from './tipos';

export const LADOS_PIEZA: LadoPieza[] = [
  'superior',
  'inferior',
  'izquierdo',
  'derecho',
];

/** Lados que corren a lo largo del ANCHO (y por eso agrandan el alto). */
export const LADOS_EJE_ALTO: LadoPieza[] = ['superior', 'inferior'];

/**
 * Las 4 esquinas, cada una como el par de lados que la comparten. Sirve para
 * no contar dos veces el ojal de una esquina cuando ambos lados adyacentes
 * llevan ojales.
 */
export const ESQUINAS: Array<[LadoPieza, LadoPieza]> = [
  ['superior', 'izquierdo'],
  ['superior', 'derecho'],
  ['inferior', 'izquierdo'],
  ['inferior', 'derecho'],
];

/** Largo del lado: los horizontales miden el ancho, los verticales el alto. */
export function largoDelLadoMm(
  lado: LadoPieza,
  anchoMm: number,
  altoMm: number,
): number {
  return LADOS_EJE_ALTO.includes(lado) ? anchoMm : altoMm;
}

/**
 * Lee un `lados` de `paramsPasoJson`, descartando valores desconocidos y
 * devolviéndolos en orden canónico. Array vacío = paso mal configurado.
 */
export function parsearLados(valor: unknown): LadoPieza[] {
  const crudos = Array.isArray(valor) ? valor : [];
  return LADOS_PIEZA.filter((lado) => crudos.includes(lado));
}
