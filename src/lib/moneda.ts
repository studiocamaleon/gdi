/**
 * EL formateador de dinero. Uno solo.
 *
 * Antes de este archivo había ~27 definiciones locales en el front, todas con
 * `"$"` y `"es-AR"` cableados. Acá el símbolo, los decimales y los
 * separadores salen de la moneda del tenant (`useConfigRegional().moneda`),
 * y CLP —cero decimales, el caso que rompe todo lo asumido— se ve bien sin
 * que ningún call site lo sepa.
 *
 * Hay un ESPEJO en `apps/api/src/common/moneda.ts` (PDFs, mensajes,
 * WhatsApp); si se toca uno se tocan los dos.
 *
 * Ver docs/multi-moneda-zona-horaria-diseno.md (D6, D7).
 */

import { monedaDe, type Moneda } from "./monedas";

/**
 * "$ 1.234,56" / "CLP: $ 1.235" / "L 1,234.56" — para PANTALLA, usuario
 * logueado que sabe en qué moneda trabaja.
 *
 * `decimales` pisa los de la moneda: los KPIs y las tablas densas muestran
 * enteros aunque la moneda tenga centavos (era el `Math.round` de la mitad
 * de los formatters viejos).
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
 * frontera (PDF, link público): cinco países comparten el `$` y un total
 * pelado no dice nada.
 */
export function formatearMonedaDoc(
  valor: number,
  moneda: Moneda,
  opts?: { decimales?: number },
): string {
  return `${moneda.simboloDoc} ${numeroMoneda(valor, moneda, opts?.decimales)}`;
}

/** Sólo el número, con los separadores y decimales de la moneda. */
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

/**
 * "$ 1,2M" / "$ 850k" — para ejes y KPIs donde el ancho manda. Unifica las
 * DOS abreviaturas que convivían (`panel-general.fmtK` y la de deudores).
 */
export function abreviarMoneda(valor: number, moneda: Moneda): string {
  return `${moneda.simbolo} ${abreviarNumero(valor, moneda)}`;
}

/** La abreviatura sin símbolo, para cuando el símbolo va aparte (prop `currency`). */
export function abreviarNumero(valor: number, moneda: Moneda): string {
  const abs = Math.abs(valor);
  if (abs >= 1e6) {
    return (
      new Intl.NumberFormat(moneda.locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      }).format(valor / 1e6) + "M"
    );
  }
  if (abs >= 1e3) {
    return (
      new Intl.NumberFormat(moneda.locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: abs >= 100e3 ? 0 : 1,
      }).format(valor / 1e3) + "k"
    );
  }
  return numeroMoneda(valor, moneda, 0);
}

/**
 * Lo que tipeó el usuario → número, según los separadores de SU moneda:
 * "1.234,56" en Argentina y "1,234.56" en Honduras son el mismo monto.
 *
 * Reemplaza a los 17 `replace(",", ".")` sueltos —que sin `/g` convertían
 * "1.234,56" en NaN— y redondea a los decimales de la moneda: en CLP no
 * existen los centavos ni tipeados a propósito.
 *
 * Null si no se puede interpretar; el caller decide si es error o vacío.
 */
export function parsearMonto(texto: string, moneda: Moneda): number | null {
  const t = texto.trim();
  if (!t) return null;

  const { grupo, decimal } = separadoresDe(moneda.locale);
  let limpio = t.replace(/\s/g, "");
  // Los separadores de miles se descartan; el decimal pasa a ".".
  limpio = limpio.split(grupo).join("");
  if (decimal !== ".") limpio = limpio.replace(decimal, ".");

  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  if (!Number.isFinite(n)) return null;

  const factor = Math.pow(10, moneda.decimales);
  return Math.round(n * factor) / factor;
}

/** Qué usa este locale para agrupar y para los decimales, según ICU. */
function separadoresDe(locale: string): { grupo: string; decimal: string } {
  const partes = new Intl.NumberFormat(locale).formatToParts(12345.6);
  return {
    grupo: partes.find((p) => p.type === "group")?.value ?? ".",
    decimal: partes.find((p) => p.type === "decimal")?.value ?? ",",
  };
}

export { monedaDe, type Moneda };
