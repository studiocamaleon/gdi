import type { Cobro } from "./administracion";

export const montoCobroEnOrden = (cobro: Cobro) =>
  cobro.montoAplicadoOrden ?? cobro.montoBruto;

/** Comisiones y retenciones del recibo completo, proporcionales a esta OT. */
export function porcionCobroEnOrden(cobro: Cobro, monto: number) {
  if (cobro.montoBruto <= 0) return 0;
  return Math.round((monto * montoCobroEnOrden(cobro) / cobro.montoBruto) * 100) / 100;
}
