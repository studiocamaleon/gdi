import type { EmbudoEtapaPanel } from "./panel-api";

export type ModoEmbudo = "cantidad" | "monto";
const ratio = (valor: number, base: number) =>
  base > 0 ? (valor / base) * 100 : null;

/** Escalas de presentación: los importes de las OT pueden superar al presupuesto. */
export function etapasDelEmbudo(funnel: EmbudoEtapaPanel[], modo: ModoEmbudo) {
  const valores = funnel.map((e) => e[modo]);
  const base = valores[0] ?? 0;
  const maximo = Math.max(0, ...valores);
  return funnel.map((e, i) => ({
    ...e,
    valor: valores[i],
    anchoPct: maximo > 0 ? Math.max(0, (valores[i] / maximo) * 100) : 0,
    share: ratio(valores[i], base),
    conversion: i > 0 ? ratio(valores[i], valores[i - 1]) : null,
  }));
}

/** Las fechas disponibles miden emisión/finalización de OT, no entrega física. */
export function referenciaDelTramo(tramo: string) {
  switch (tramo) {
    case "Emitida → aprobada":
      return {
        label: "Envío → aprobación",
        referencia:
          "Desde el envío hasta la resolución del presupuesto aprobado.",
      };
    case "Aprobada → producción":
      return {
        label: "Aprobación → emisión de OT",
        referencia:
          "Usa la emisión de la OT en casos que alcanzaron producción.",
      };
    case "Producción → entrega":
      return {
        label: "Emisión de OT → finalización",
        referencia: "Hasta la finalización de producción registrada en la OT.",
      };
    default:
      return {
        label: tramo,
        referencia: "Según las fechas registradas del tramo.",
      };
  }
}
