import { apiRequest } from "@/lib/api";
import { Maquina, MaquinaPayload } from "@/lib/maquinaria";

export async function getMaquinas() {
  const res = await apiRequest<{ data: Maquina[] }>("/maquinaria?limit=200");
  return res.data;
}

export async function getMaquina(id: string) {
  return apiRequest<Maquina>(`/maquinaria/${id}`);
}

// perfilOperativoNombre es estado de UI: el backend resuelve el perfil por
// perfilOperativoId y rechaza campos no declarados (forbidNonWhitelisted).
function toApiPayload(payload: MaquinaPayload): MaquinaPayload {
  return {
    ...payload,
    consumibles: payload.consumibles.map(
      ({ perfilOperativoNombre: _ignored, ...consumible }) => consumible,
    ),
  };
}

export async function createMaquina(payload: MaquinaPayload) {
  return apiRequest<Maquina>("/maquinaria", {
    method: "POST",
    body: JSON.stringify(toApiPayload(payload)),
  });
}

export async function updateMaquina(id: string, payload: MaquinaPayload) {
  return apiRequest<Maquina>(`/maquinaria/${id}`, {
    method: "PUT",
    body: JSON.stringify(toApiPayload(payload)),
  });
}

export async function toggleMaquina(id: string) {
  return apiRequest<Maquina>(`/maquinaria/${id}/toggle`, {
    method: "PATCH",
  });
}
