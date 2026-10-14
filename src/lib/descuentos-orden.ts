import type { PropuestaItem } from "./propuestas";
import { descuentoMontoDeItem } from "./orden-productos-presentacion";
import { metaCentroCopiado } from "./centro-copiado-api";

export type DescuentoInput = NonNullable<PropuestaItem["descuentoInput"]>;

/** Neto antes del descuento: base compartida por el preview y el motor. */
export function netoListaDeItem(item: PropuestaItem): number {
  const desglose = item.cotizacion.desglosePrecio;
  return (
    desglose?.descuento?.netoListaTotal ??
    desglose?.precioNetoTotal ??
    item.subtotal ??
    0
  );
}

/**
 * Aviso informativo para catálogo. Copiado consulta su contribución en Costos:
 * el margen de la recotización general no representa el precio del tarifario.
 * Un margen ausente (también por permisos) nunca equivale a un margen de cero.
 */
export function avisoMargenDescuento(
  items: readonly PropuestaItem[],
  verMargenes: boolean,
): string | null {
  if (!verMargenes) return null;
  const margenes = items
    .filter(
      (item) =>
        !metaCentroCopiado(item.jobContext) && descuentoMontoDeItem(item) > 0,
    )
    .map((item) => item.cotizacion.desglosePrecio?.margenEfectivoPct)
    .filter(
      (margen): margen is number =>
        typeof margen === "number" && Number.isFinite(margen),
    );
  const minimo = margenes.length ? Math.min(...margenes) : null;
  return minimo != null && minimo < 15
    ? `El margen queda en ${minimo.toLocaleString("es-AR", { maximumFractionDigits: 1 })}% en el producto más ajustado. Revisá antes de emitir.`
    : null;
}
