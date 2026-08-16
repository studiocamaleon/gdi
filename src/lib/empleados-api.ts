import { ApiError, apiRequest } from "@/lib/api";
import {
  EmpleadoDetalle,
  EmpleadoOpcion,
  EmpleadoPayload,
  EmpleadoResumen,
} from "@/lib/empleados";

export type EmpleadosListResponse = {
  data: EmpleadoResumen[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

/** Catálogo liviano de empleados activos para selectores operativos. */
export async function getEmpleados() {
  return apiRequest<EmpleadoOpcion[]>("/empleados/opciones");
}

export async function listEmpleados(params?: {
  q?: string;
  page?: number;
  limit?: number;
  incluirInactivos?: boolean;
}) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.incluirInactivos) query.set("incluirInactivos", "true");
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiRequest<EmpleadosListResponse>(`/empleados${suffix}`);
}

export async function getEmpleadoById(id: string) {
  try {
    return await apiRequest<EmpleadoDetalle>(`/empleados/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function createEmpleado(payload: EmpleadoPayload) {
  return apiRequest<EmpleadoDetalle>("/empleados", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function importarEmpleados(empleados: EmpleadoPayload[]) {
  return apiRequest<{ data: EmpleadoDetalle[]; total: number }>(
    "/empleados/importar",
    {
      method: "POST",
      body: JSON.stringify({ empleados }),
    },
  );
}

export async function updateEmpleado(
  id: string,
  payload: EmpleadoPayload & { updatedAt: string },
) {
  return apiRequest<EmpleadoDetalle>(`/empleados/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function setEmpleadoActivo(
  id: string,
  activo: boolean,
  motivo?: string,
) {
  return apiRequest<EmpleadoDetalle>(`/empleados/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ activo, motivo }),
  });
}

export async function setEmpleadosActivos(
  ids: string[],
  activo: boolean,
  motivo?: string,
) {
  return apiRequest<{ total: number }>("/empleados/estado", {
    method: "PATCH",
    body: JSON.stringify({ ids, activo, motivo }),
  });
}
