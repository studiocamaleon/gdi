/**
 * ESPEJO de `src/lib/moneda.ts` (el front): el formateador de dinero del
 * API — PDFs, mensajes de timeline, alertas y payloads de WhatsApp. No hay
 * paquete compartido; si se toca uno se tocan los dos.
 *
 * La única diferencia real con el front es que acá no hay `parsearMonto`:
 * el API recibe números por DTO, no texto tipeado.
 *
 * Ver docs/multi-moneda-zona-horaria-diseno.md (D6, D7).
 */

import { monedaDe, type Moneda } from './monedas';

/**
 * "$ 1.234,56" / "L 1,234.56" — para superficies que ve el usuario logueado
 * (mensajes de error, timeline, alertas).
 */
export function formatearMoneda(
  valor: number,
  moneda: Moneda,
  opts?: { decimales?: number },
): string {
  return `${moneda.simbolo} ${numeroMoneda(valor, moneda, opts?.decimales)}`;
}

/**
 * "AR$ 1.234,56" / "CLP $ 1.235" — para DOCUMENTOS que pueden cruzar una
 * frontera (los 4 PDFs): cinco países comparten el `$` y un total pelado no
 * dice nada.
 */
export function formatearMonedaDoc(
  valor: number,
  moneda: Moneda,
  opts?: { decimales?: number },
): string {
  return `${moneda.simboloDoc} ${numeroMoneda(valor, moneda, opts?.decimales)}`;
}

/**
 * Sólo el número, con los separadores y decimales de la moneda. Es lo que
 * viaja en una variable de WhatsApp: el símbolo ya está en el texto fijo de
 * la plantilla aprobada por Meta.
 */
export function numeroMoneda(
  valor: number,
  moneda: Moneda,
  decimales?: number,
): string {
  const d = decimales ?? moneda.decimales;
  return new Intl.NumberFormat(moneda.locale, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(valor);
}

export { monedaDe, type Moneda };
