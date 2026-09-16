import type { PropuestaItem } from "./propuestas";

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
