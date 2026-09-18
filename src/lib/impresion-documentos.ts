import type { EstadoDocumento } from "./impresion-api";
export const textoEstadoDocumento: Record<EstadoDocumento, string> = {
  PREPARADO: "Envío preparado · sin confirmación",
  ENVIADO: "Enviado a Windows",
  SPOOLING: "Preparando en la cola",
  SCHEDULED: "En cola",
  PRINTING: "Imprimiendo",
  SENT: "Enviado a la impresora",
  COMPLETE: "Finalizado según la cola",
  PRINTED: "Impreso según la cola",
  DELETED: "Retirado de la cola · verificar salida",
  CANCELED: "Cancelado en la cola",
  ABORTED: "Interrumpido",
  ERROR: "Requiere atención",
  PAUSED: "En pausa",
  SIN_CONFIRMAR: "Envío sin confirmar · revisar cola",
};
export function estadoDocumentoQz(estado: string): EstadoDocumento | null {
  if (estado in textoEstadoDocumento) return estado as EstadoDocumento;
  return [
    "PAPER_OUT",
    "PAPEROUT",
    "PAPER_JAM",
    "OFFLINE",
    "USER_INTERVENTION",
    "NO_TONER",
    "DOOR_OPEN",
    "NOT_AVAILABLE",
  ].includes(estado)
    ? "ERROR"
    : null;
}
export function estadoDocumentoSiguiente(
  actual: EstadoDocumento,
  nuevo: EstadoDocumento,
): EstadoDocumento {
  if (["COMPLETE", "PRINTED", "CANCELED", "ABORTED"].includes(actual))
    return actual;
  if (nuevo === "PREPARADO") return actual;
  if (
    ["ENVIADO", "SIN_CONFIRMAR"].includes(nuevo) &&
    !["PREPARADO", "SIN_CONFIRMAR"].includes(actual)
  )
    return actual;
  if (
    actual === "PRINTING" &&
    ["SPOOLING", "SCHEDULED", "SENT"].includes(nuevo)
  )
    return actual;
  return nuevo;
}
