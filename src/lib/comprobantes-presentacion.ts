import type { Comprobante } from "./administracion";

/** Fechas de documento, sin convertir la fecha civil a otra zona horaria. */
export function fechaComprobante(fecha: string | null) {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

/** El estado del documento no se deduce de un saldo cero. */
export function etiquetaSaldoComprobante(
  c: Comprobante,
  fmt: (n: number) => string,
) {
  if (c.estado !== "emitido") return "—";
  if (c.tipo === "nota_credito") return "Aplicada";
  if (c.corregido && c.saldoPendiente <= 0) return "Corregido";
  if (c.total < 0) return "—";
  return c.saldoPendiente > 0 ? fmt(c.saldoPendiente) : "Cobrado";
}
