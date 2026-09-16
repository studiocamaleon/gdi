import type { TableroPasoData } from "./tablero-produccion";

function fechaValida(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function finPrevistoPaso(paso?: TableroPasoData): Date | null {
  return (
    fechaValida(paso?.planReferencia?.fin) ??
    fechaValida(paso?.planificadoHasta)
  );
}

/** El cierre real prevalece al completar. Las franjas de personal incluyen
 * separación y no representan el fin de la operación. */
export function finActualPaso(
  paso?: TableroPasoData,
  finEstimado?: Date,
): Date | null {
  if (paso?.estado === "hecho") return fechaValida(paso.completadoEl);
  return finEstimado && Number.isFinite(finEstimado.getTime())
    ? finEstimado
    : null;
}

export function duracionDesvio(minutos: number): string {
  const valor = Math.abs(minutos),
    dias = Math.floor(valor / 1440),
    horas = Math.floor((valor % 1440) / 60),
    mins = valor % 60;
  return (
    [
      dias ? `${dias} d` : "",
      horas ? `${horas} h` : "",
      mins ? `${mins} min` : "",
    ]
      .filter(Boolean)
      .join(" ") || "0 min"
  );
}

/** Precisión de un minuto, igual que las fechas visibles. Tiempo calendario. */
export function cumplimientoPaso(previsto: Date | null, actual: Date | null) {
  if (!previsto || !actual)
    return { tipo: "sin-datos" as const, texto: "Sin datos", minutos: null };
  const minutos =
    Math.floor(actual.getTime() / 60000) -
    Math.floor(previsto.getTime() / 60000);
  return {
    tipo:
      minutos === 0
        ? ("en-horario" as const)
        : minutos > 0
          ? ("demorado" as const)
          : ("adelantado" as const),
    texto:
      minutos === 0
        ? "En horario"
        : `${minutos > 0 ? "Demorado" : "Adelantado"} ${duracionDesvio(minutos)}`,
    minutos,
  };
}
