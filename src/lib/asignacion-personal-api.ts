import { apiRequest } from "./api";
import type {
  ContextoAsignacionPersonal,
  RevisionAsignacionPersonal,
} from "../../apps/api/src/ordenes-trabajo/asignacion-personal.contrato";
export type {
  ContextoAsignacionPersonal,
  RevisionAsignacionPersonal,
  ImpactoPasoAsignacion,
} from "../../apps/api/src/ordenes-trabajo/asignacion-personal.contrato";

const ruta = (pasoId: string) =>
  `/ordenes-trabajo/tablero/pasos/${encodeURIComponent(pasoId)}/asignacion-personal`;

export function getContextoAsignacionPersonal(
  pasoId: string,
  signal?: AbortSignal,
) {
  return apiRequest<ContextoAsignacionPersonal>(ruta(pasoId), { signal });
}
export function simularAsignacionPersonal(
  pasoId: string,
  empleadoIds: string[],
) {
  return apiRequest<RevisionAsignacionPersonal>(`${ruta(pasoId)}/simular`, {
    method: "POST",
    body: JSON.stringify({ empleadoIds }),
  });
}
export function confirmarAsignacionPersonal(
  pasoId: string,
  token: string,
  motivo?: string,
) {
  return apiRequest<{ confirmado: boolean; pasoId: string }>(
    `${ruta(pasoId)}/confirmar`,
    { method: "POST", body: JSON.stringify({ token, motivo }) },
  );
}
