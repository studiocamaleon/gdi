import { apiRequest } from "@/lib/api";

/**
 * Gastos fijos de estructura — fuente del pool de costos fijos del punto de
 * equilibrio. Ver docs/gastos-fijos-estructura-diseno.md
 */

export type FrecuenciaGastoFijo =
  | "MENSUAL"
  | "BIMESTRAL"
  | "TRIMESTRAL"
  | "SEMESTRAL"
  | "ANUAL";

export const FRECUENCIAS_GASTO_FIJO: Array<{
  value: FrecuenciaGastoFijo;
  label: string;
}> = [
  { value: "MENSUAL", label: "Mes" },
  { value: "BIMESTRAL", label: "Bimestre" },
  { value: "TRIMESTRAL", label: "Trimestre" },
  { value: "SEMESTRAL", label: "Semestre" },
  { value: "ANUAL", label: "Año" },
];

export const FRECUENCIA_LABEL: Record<FrecuenciaGastoFijo, string> =
  Object.fromEntries(
    FRECUENCIAS_GASTO_FIJO.map((f) => [f.value, f.label]),
  ) as Record<FrecuenciaGastoFijo, string>;

export type GastoFijo = {
  id: string;
  nombre: string;
  /** Del catálogo compartido con Cuentas por pagar. */
  categoriaEgresoId: string;
  categoriaNombre: string;
  categoriaCodigo: string;
  /** El valor de UNA cuota, tal como se carga. */
  valor: number;
  frecuencia: FrecuenciaGastoFijo;
  /** Derivado de valor y frecuencia: lo que suma al punto de equilibrio. */
  importeMensual: number;
  proveedorId: string | null;
  /** El "Favorecido" del listado. */
  proveedorNombre: string | null;
  metodoPagoId: string | null;
  metodoPagoNombre: string | null;
  documento: string | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activo: boolean;
  notas: string | null;
};

/**
 * Lo que se manda al guardar. Va el valor de la cuota, no el mensual: ese lo
 * deriva el servidor cruzándolo con la frecuencia.
 */
export type GastoFijoPayload = {
  nombre: string;
  categoriaEgresoId: string;
  valor: number;
  frecuencia: FrecuenciaGastoFijo;
  proveedorId?: string | null;
  metodoPagoId?: string | null;
  documento?: string | null;
  vigenteDesde: string;
  vigenteHasta?: string | null;
  activo?: boolean;
  notas?: string | null;
};

export type ImportarResultado = {
  importados: number;
  total: number;
  motivo?: "ya_existen_gastos" | "sin_datos";
};

export function getGastosFijos() {
  return apiRequest<GastoFijo[]>("/gastos-fijos");
}

export function createGastoFijo(payload: GastoFijoPayload) {
  return apiRequest<GastoFijo>("/gastos-fijos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateGastoFijo(id: string, payload: GastoFijoPayload) {
  return apiRequest<GastoFijo>(`/gastos-fijos/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function toggleGastoFijo(id: string) {
  return apiRequest<GastoFijo>(`/gastos-fijos/${id}/toggle`, { method: "PATCH" });
}

export function eliminarGastoFijo(id: string) {
  return apiRequest<{ id: string; eliminado: boolean }>(`/gastos-fijos/${id}`, {
    method: "DELETE",
  });
}
