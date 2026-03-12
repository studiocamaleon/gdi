import { apiRequest, ApiError } from "@/lib/api";
import type { MateriaPrima, MateriaPrimaPayload } from "@/lib/materias-primas";

export async function getMateriasPrimas() {
  return apiRequest<MateriaPrima[]>("/inventario/materias-primas");
}

export async function getMateriaPrimaById(id: string) {
  try {
    return await apiRequest<MateriaPrima>(`/inventario/materias-primas/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function createMateriaPrima(payload: MateriaPrimaPayload) {
  return apiRequest<MateriaPrima>("/inventario/materias-primas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMateriaPrima(id: string, payload: MateriaPrimaPayload) {
  return apiRequest<MateriaPrima>(`/inventario/materias-primas/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function toggleMateriaPrima(id: string) {
  return apiRequest<MateriaPrima>(`/inventario/materias-primas/${id}/toggle`, {
    method: "PATCH",
  });
}
