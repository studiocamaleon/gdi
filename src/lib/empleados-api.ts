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

/* ─── Remuneraciones ─────────────────────────────────────────────────────────
 * El sueldo vive en el legajo, no en cada centro de costo. Los centros
 * consumen de acá. Ver docs/legajos-nomina-diseno.md
 */

export const MOTIVOS_REMUNERACION = [
  { value: "alta", label: "Alta" },
  { value: "paritaria", label: "Paritaria" },
  { value: "ascenso", label: "Ascenso" },
  { value: "correccion", label: "Corrección" },
  { value: "otro", label: "Otro" },
] as const;

export type MotivoRemuneracion = (typeof MOTIVOS_REMUNERACION)[number]["value"];

export type Remuneracion = {
  id: string;
  empleadoId: string;
  /** 'YYYY-MM' */
  vigenteDesde: string;
  vigenteHasta: string | null;
  sueldoNeto: number;
  cargasSociales: number;
  /** 13 con aguinaldo, 12 sin. */
  sueldosPorAnio: number;
  /** neto + cargas: lo que se paga en un mes común. */
  costoMensualSinSac: number;
  /** La parte del aguinaldo que le toca a cada mes. */
  provisionSacMensual: number;
  /** Lo que cuesta por mes de verdad, con el SAC prorrateado. */
  costoMensual: number;
  motivo: MotivoRemuneracion | null;
  notas: string | null;
};

export type RemuneracionPayload = {
  vigenteDesde: string;
  vigenteHasta?: string | null;
  sueldoNeto: string;
  cargasSociales: string;
  sueldosPorAnio?: number;
  motivo?: MotivoRemuneracion;
  notas?: string;
};

export async function getRemuneraciones(empleadoId: string) {
  return apiRequest<Remuneracion[]>(`/empleados/${empleadoId}/remuneraciones`);
}

export async function crearRemuneracion(
  empleadoId: string,
  payload: RemuneracionPayload,
) {
  return apiRequest<Remuneracion>(`/empleados/${empleadoId}/remuneraciones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function actualizarRemuneracion(
  empleadoId: string,
  id: string,
  payload: RemuneracionPayload,
) {
  return apiRequest<Remuneracion>(
    `/empleados/${empleadoId}/remuneraciones/${id}`,
    { method: "PUT", body: JSON.stringify(payload) },
  );
}

export async function eliminarRemuneracion(empleadoId: string, id: string) {
  return apiRequest<void>(`/empleados/${empleadoId}/remuneraciones/${id}`, {
    method: "DELETE",
  });
}
