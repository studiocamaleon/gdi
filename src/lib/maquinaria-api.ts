import { apiRequest } from "@/lib/api";
import {
  Maquina,
  MaquinaResumen,
  MaquinaPayload,
  MaquinaHistorialEvento,
  MaquinasPage,
  type EstadoConfiguracionMaquina,
  type EstadoMaquina,
  type PlantillaMaquinaria,
} from "@/lib/maquinaria";

export async function getMaquinas() {
  const res = await apiRequest<{ data: MaquinaResumen[] }>(
    "/maquinaria?limit=200",
  );
  return res.data;
}

export async function getMaquinasPage(
  filters: {
    page?: number;
    limit?: number;
    search?: string;
    plantilla?: PlantillaMaquinaria;
    estado?: EstadoMaquina;
    estadoConfiguracion?: EstadoConfiguracionMaquina;
  } = {},
) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 50));
  if (filters.search) params.set("search", filters.search);
  if (filters.plantilla) params.set("plantilla", filters.plantilla);
  if (filters.estado) params.set("estado", filters.estado);
  if (filters.estadoConfiguracion) {
    params.set("estadoConfiguracion", filters.estadoConfiguracion);
  }
  return apiRequest<MaquinasPage>(`/maquinaria?${params.toString()}`);
}

export async function getMaquina(id: string) {
  return apiRequest<Maquina>(`/maquinaria/${id}`);
}

export async function getMaquinaHistorial(id: string) {
  return apiRequest<MaquinaHistorialEvento[]>(`/maquinaria/${id}/historial`);
}

// perfilOperativoNombre es estado de UI: el backend resuelve el perfil por
// perfilOperativoId y rechaza campos no declarados (forbidNonWhitelisted).
function toApiPayload(payload: MaquinaPayload): MaquinaPayload {
  return {
    ...payload,
    consumibles: payload.consumibles.map((item) => {
      const { perfilOperativoNombre, ...consumible } = item;
      void perfilOperativoNombre;
      return consumible;
    }),
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

export async function setMaquinaActiva(id: string, activo: boolean) {
  return apiRequest<Maquina>(`/maquinaria/${id}/activo`, {
    method: "PATCH",
    body: JSON.stringify({ activo }),
  });
}
