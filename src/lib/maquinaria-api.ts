import { apiRequest } from "@/lib/api";
import { Maquina, MaquinaPayload } from "@/lib/maquinaria";

export async function getMaquinas() {
  return apiRequest<Maquina[]>("/maquinaria");
}

export async function getMaquina(id: string) {
  return apiRequest<Maquina>(`/maquinaria/${id}`);
}

export async function createMaquina(payload: MaquinaPayload) {
  return apiRequest<Maquina>("/maquinaria", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMaquina(id: string, payload: MaquinaPayload) {
  return apiRequest<Maquina>(`/maquinaria/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function toggleMaquina(id: string) {
  return apiRequest<Maquina>(`/maquinaria/${id}/toggle`, {
    method: "PATCH",
  });
}
