import type { MetaPanel } from "./panel-api";

/** El margen negativo es un resultado real; nunca recortarlo para el gráfico. */
export function serieDelResumen(
  serie: Array<{ fecha: string; monto: number; costo: number }>,
) {
  return serie.map((punto) => ({
    fecha: punto.fecha,
    ventas: punto.monto,
    costo: punto.costo,
    margen: punto.monto - punto.costo,
  }));
}

/** Las claves de calendario se formatean sin convertirlas a la zona del navegador. */
export function fechaDelReporte(
  clave: string,
  granularidad: MetaPanel["granularidad"],
  completa = false,
) {
  const fecha = new Date(`${clave.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(fecha.getTime())) return clave;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    ...(granularidad === "mes"
      ? { month: "short" as const, year: "numeric" as const }
      : {
          day: "numeric" as const,
          month: "short" as const,
          ...(completa ? { year: "numeric" as const } : {}),
        }),
  }).format(fecha);
}
