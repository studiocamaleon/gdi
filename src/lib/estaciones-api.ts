import { apiRequest } from "@/lib/api";
import type { Estacion, EstacionPayload } from "@/lib/estaciones";

export async function getEstaciones() {
  return apiRequest<Estacion[]>("/produccion/estaciones");
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
