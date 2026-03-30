import { ApiError, apiRequest } from "@/lib/api";
import { EmpleadoDetalle, EmpleadoPayload } from "@/lib/empleados";

export async function getEmpleados() {
  const res = await apiRequest<{ data: EmpleadoDetalle[] }>("/empleados?limit=200");
  return res.data;
}

export async function getEmpleadoById(id: string) {
  try {
    return await apiRequest<EmpleadoDetalle>(`/empleados/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function createEmpleado(payload: EmpleadoPayload) {
  return apiRequest<EmpleadoDetalle>("/empleados", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEmpleado(id: string, payload: EmpleadoPayload) {
  return apiRequest<EmpleadoDetalle>(`/empleados/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteEmpleado(id: string) {
  return apiRequest<void>(`/empleados/${id}`, {
    method: "DELETE",
  });
}

export async function inviteEmpleadoAccess(
  id: string,
  payload: { email: string; rolSistema: EmpleadoPayload["rolSistema"] },
) {
  return apiRequest<{ invitationState: string; invitationUrl: string | null }>(
    `/empleados/${id}/invitar-acceso`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
