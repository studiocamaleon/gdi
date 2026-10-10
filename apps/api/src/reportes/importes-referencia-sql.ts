/** Referencia informativa de los mismos productos que integran las ventas.
 * No incluye cargos generales ni cambia las bases de margen/contribución.
 * Los totales persistidos respetan alícuotas, descuentos y redondeos; una OT
 * sin comprobante conserva el neto aunque el snapshot del ítem tenga IVA.
 * Fragmento interno: exige los alias oti (ítem) y ot (orden). */
export const PRODUCTO_CON_IVA_SQL = `CASE
  WHEN ot."tratamientoFiscal" = 'SIN_COMPROBANTE' THEN oti.subtotal
  ELSE oti.total END`;
