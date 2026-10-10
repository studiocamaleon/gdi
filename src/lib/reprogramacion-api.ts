import { apiRequest } from "./api";
import type {
  RevisionReprogramacion,
  SolicitudReprogramacion,
} from "../../apps/api/src/ordenes-trabajo/reprogramacion.contrato";
export type {
  RevisionReprogramacion,
  SolicitudReprogramacion,
} from "../../apps/api/src/ordenes-trabajo/reprogramacion.contrato";
const ruta = (pasoId: string) =>
  `/ordenes-trabajo/tablero/pasos/${encodeURIComponent(pasoId)}/reprogramacion`;
export function simularReprogramacion(
  pasoId: string,
  solicitud: SolicitudReprogramacion,
) {
  return apiRequest<RevisionReprogramacion>(`${ruta(pasoId)}/simular`, {
    method: "POST",
    body: JSON.stringify(solicitud),
  });
}
export function confirmarReprogramacion(
  pasoId: string,
  token: string,
  motivo?: string,
) {
  return apiRequest<{ confirmado: boolean }>(`${ruta(pasoId)}/confirmar`, {
    method: "POST",
    body: JSON.stringify({ token, motivo }),
  });
}
