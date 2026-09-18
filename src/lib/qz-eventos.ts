const ESTADOS: Record<string, string> = {
  OK: "Disponible",
  PRINTING: "Imprimiendo",
  SPOOLING: "Preparando en la cola",
  SCHEDULED: "En cola",
  SENT: "Enviado a la impresora",
  COMPLETE: "Finalizado según la cola",
  PRINTED: "Impreso según la cola",
  DELETED: "Retirado de la cola",
  DELETING: "Retirándose de la cola",
  CANCELED: "Cancelado",
  ABORTED: "Interrumpido",
  ERROR: "Error",
  PAPER_OUT: "Sin papel",
  PAPEROUT: "Sin papel",
  PAPER_JAM: "Atasco de papel",
  PAPER_PROBLEM: "Problema con el papel",
  OFFLINE: "Impresora desconectada",
  NOT_AVAILABLE: "No disponible",
  PAUSED: "En pausa",
  TONER_LOW: "Tóner bajo",
  NO_TONER: "Sin tóner",
  DOOR_OPEN: "Tapa abierta",
  USER_INTERVENTION: "Requiere atención",
  OUTPUT_BIN_FULL: "Bandeja de salida llena",
  BUSY: "Ocupada",
  PROCESSING: "Procesando",
  WARMING_UP: "Calentando",
  WAITING: "En espera",
  UNKNOWN: "Estado no informado",
  RETAINED: "Conservado en la cola",
  RESTART: "Reiniciado",
  POWER_SAVE: "Ahorro de energía",
};
export type EventoImpresora = {
  hora: string;
  tipo: "JOB" | "PRINTER";
  estado: string;
  detalle: string;
  severidad: string;
  jobName: string;
  jobId: string;
};
/** Sólo la cola elegida y los trabajos conocidos del piloto. No captura documentos ajenos. */
export function eventoImpresora(
  dato: unknown,
  impresora: string,
  trabajos: ReadonlySet<string>,
): EventoImpresora | null {
  if (!dato || typeof dato !== "object") return null;
  const d = dato as Record<string, unknown>;
  if (
    d.printerName !== impresora ||
    !["JOB", "PRINTER"].includes(String(d.eventType))
  )
    return null;
  const jobName = typeof d.jobName === "string" ? d.jobName : "";
  if (d.eventType === "JOB" && !trabajos.has(jobName)) return null;
  const estado =
    typeof d.statusText === "string" ? d.statusText.slice(0, 100) : "UNKNOWN";
  return {
    hora: new Date().toISOString(),
    tipo: d.eventType as "JOB" | "PRINTER",
    estado,
    detalle: ESTADOS[estado] ?? `Estado informado: ${estado}`,
    severidad: String(d.severity ?? "INFO").slice(0, 20),
    jobName,
    jobId:
      typeof d.jobId === "number" || typeof d.jobId === "string"
        ? String(d.jobId).slice(0, 100)
        : "",
  };
}
