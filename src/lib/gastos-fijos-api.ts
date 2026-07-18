import { apiRequest } from "@/lib/api";

/**
 * Gastos fijos de estructura — fuente del pool de costos fijos del punto de
 * equilibrio. Ver docs/gastos-fijos-estructura-diseno.md
 */

export type CategoriaGastoFijo =
  | "ALQUILER"
  | "SUELDOS"
  | "SERVICIOS"
  | "AMORTIZACION"
  | "FINANCIEROS"
  | "IMPUESTOS"
  | "MARKETING"
  | "OTROS";

export const CATEGORIAS_GASTO_FIJO: Array<{ value: CategoriaGastoFijo; label: string }> = [
  { value: "ALQUILER", label: "Alquiler" },
  { value: "SUELDOS", label: "Sueldos" },
  { value: "SERVICIOS", label: "Servicios (luz, agua, internet)" },
  { value: "AMORTIZACION", label: "Amortización (máquinas/equipos)" },
  { value: "FINANCIEROS", label: "Financieros (intereses, leasing)" },
  { value: "IMPUESTOS", label: "Impuestos fijos" },
  { value: "MARKETING", label: "Marketing" },
  { value: "OTROS", label: "Otros" },
];

export type GastoFijo = {
  id: string;
  nombre: string;
  categoria: CategoriaGastoFijo;
  importeMensual: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activo: boolean;
  notas: string | null;
};

export type GastoFijoPayload = {
  nombre: string;
  categoria: CategoriaGastoFijo;
  importeMensual: number;
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

export function importarGastosDesdeTarifas() {
  return apiRequest<ImportarResultado>("/gastos-fijos/importar-desde-tarifas", {
    method: "POST",
  });
}
