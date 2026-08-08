/**
 * Renglones de factura desde los items de una OT CON descuento comercial,
 * expresando el descuento como bonificación (F5 de descuentos): la línea lleva
 * el precio de LISTA y `bonificacionPct`, y `calcularTotales` la bonifica de
 * vuelta al precio descontado — el total no cambia, sólo se hace visible.
 *
 * La clave es que el % de bonificación es escala-libre: el descuento se aplicó
 * sobre el neto, pero el mismo porcentaje sobre el bruto (IVA incluido) llega
 * al bruto descontado, porque el IVA es proporcional al neto. Eso permite usar
 * la base que corresponde a cada letra:
 *
 * - **A**: base = neto (`subtotal` persistido, ya descontado) → lista = neto
 *   descontado + descuentoMonto.
 * - **B/C/E**: base = precio final (`total` persistido) → lista = final ÷
 *   (1 − pct). Usar el total persistido (y no neto × 1.21) hace que la suma
 *   cierre EXACTA contra la orden aunque el IVA no sea 21%.
 *
 * El pct se pasa con precisión completa (float, sin redondear) para que
 * `baseLinea` aterrice en el precio descontado al centavo; el redondeo a 2
 * decimales es sólo cosa del render.
 */

import type { LetraProvider } from './invoicing-provider';
import { calcularTotales, type ItemCalculo } from './totales-comprobante';

export type OrdenItemFacturable = {
  nombre: string;
  cantidad: number;
  /** Neto descontado (lo persistido en `OrdenTrabajoItem.subtotal`). */
  subtotal: number;
  /** Precio final descontado (subtotal + impuestos). */
  total: number;
  /** Monto del descuento comercial sobre el neto (0 si no hubo). */
  descuentoMonto: number;
};

export type ItemFacturaOrden = ItemCalculo & { descripcion: string };

export function itemsOrdenConDescuento(
  letra: LetraProvider,
  items: OrdenItemFacturable[],
): ItemFacturaOrden[] {
  return items.map((item) => {
    const descuento = Math.max(0, item.descuentoMonto);
    const netoLista = item.subtotal + descuento;
    const pct = netoLista > 0 ? (descuento / netoLista) * 100 : 0;
    const cantidad = item.cantidad > 0 ? item.cantidad : 1;
    // Base descontada según la letra; la lista se reconstruye por gross-up
    // para que bonificar devuelva EXACTAMENTE la base persistida.
    const baseDescontada = letra === 'A' ? item.subtotal : item.total;
    const baseLista =
      pct < 100 ? baseDescontada / (1 - pct / 100) : baseDescontada + descuento;
    return {
      descripcion: item.nombre,
      cantidad,
      // Sin redondear: el JSON persiste el float y cantidad × unitario
      // reconstruye la base sin acumular error por línea (redondear el
      // unitario × cantidades grandes puede desviar pesos enteros).
      precioUnitarioSinIva: baseLista / cantidad,
      alicuotaIva: 21,
      ...(pct > 0 ? { bonificacionPct: pct } : {}),
    };
  });
}

/**
 * Renglones DETALLADOS de la factura de una orden con descuento, o `null` si
 * no aplica y el caller debe caer al renglón único por monto. Aplica sólo
 * cuando el descuento puede expresarse EXACTO:
 *
 * - la orden tiene descuento comercial (si no, la factura no cambia de cara);
 * - se factura el saldo COMPLETO y de una sola vez (un monto parcial no mapea
 *   a items: el descuento ya viaja embebido en el monto);
 * - el total recalculado de las líneas cierra contra el saldo (si el perfil
 *   de impuestos hiciera divergir el recálculo, mejor renglón único que
 *   desviar la deuda de la orden).
 */
export function renglonesDetalladosOrden(params: {
  letra: LetraProvider;
  monto: number;
  saldo: number;
  facturadoTotal: number;
  descuentoTotal: number;
  items: OrdenItemFacturable[];
}): ItemFacturaOrden[] | null {
  const { letra, monto, saldo, facturadoTotal, descuentoTotal, items } = params;
  // Medio peso de tolerancia: el modal de facturar precarga el monto
  // REDONDEADO a entero — con un saldo con centavos, "100%" no daría
  // exacto y la factura caería a renglón único sin razón. El total que se
  // factura sale igual del recálculo de las líneas, no de este monto.
  const facturaCompleta =
    Math.abs(monto - saldo) <= 0.5 && facturadoTotal <= 0.01;
  if (descuentoTotal <= 0 || !facturaCompleta || items.length === 0) {
    return null;
  }
  const detallados = itemsOrdenConDescuento(letra, items);
  const recalculado = calcularTotales(letra, detallados).total;
  return Math.abs(recalculado - saldo) <= 0.05 ? detallados : null;
}
