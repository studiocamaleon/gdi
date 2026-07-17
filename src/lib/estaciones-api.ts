import { apiRequest } from "@/lib/api";
import type {
  Estacion,
  EstacionPayload,
  FamiliaPasoCatalogo,
} from "@/lib/estaciones";

export async function getEstaciones() {
  return apiRequest<Estacion[]>("/produccion/estaciones");
}

/** Catálogo de familias de pasos + qué estación tiene tomada cada una. */
export async function getFamiliasPasos() {
  return apiRequest<FamiliaPasoCatalogo[]>("/produccion/familias-pasos");
}

export async function createEstacion(payload: EstacionPayload) {
  return apiRequest<Estacion>("/produccion/estaciones", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEstacion(id: string, payload: EstacionPayload) {
  return apiRequest<Estacion>(`/produccion/estaciones/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function toggleEstacion(id: string) {
  return apiRequest<Estacion>(`/produccion/estaciones/${id}/toggle`, {
    method: "PATCH",
  });
}

export async function deleteEstacion(id: string) {
  return apiRequest<{ ok: boolean }>(`/produccion/estaciones/${id}`, {
    method: "DELETE",
  });
}
