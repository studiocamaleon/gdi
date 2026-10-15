/** El snapshot conserva el cálculo fiscal; la propuesta respeta el tratamiento elegido en la OT. */
export function itemVisiblePresupuesto<
  T extends { subtotal: number; impuestos: number; total: number },
>(item: T, tratamientoFiscal?: string): T {
  return tratamientoFiscal === 'SIN_COMPROBANTE'
    ? { ...item, impuestos: 0, total: item.subtotal }
    : item;
}
