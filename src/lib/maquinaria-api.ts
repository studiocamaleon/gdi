import { apiRequest } from "@/lib/api";
import { Maquina, MaquinaPayload } from "@/lib/maquinaria";

export async function getMaquinas() {
  const res = await apiRequest<{ data: Maquina[] }>("/maquinaria?limit=200");
  return res.data;
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
