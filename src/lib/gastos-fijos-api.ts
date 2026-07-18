import { apiRequest } from "@/lib/api";

/**
 * Gastos fijos de estructura — fuente del pool de costos fijos del punto de
 * equilibrio. Ver docs/gastos-fijos-estructura-diseno.md
 */

export type CategoriaGastoFijo =
  | "SUELDOS"
  | "ALQUILER"
  | "SERVICIOS"
  | "IMPUESTOS"
  | "SEGUROS"
  | "SOFTWARE"
  | "LEGAL"
  | "FINANCIEROS"
  | "AMORTIZACION"
  | "MARKETING"
  | "OTROS";

/** Etiqueta + color por categoría (colores del diseño Grafoprint). */
export const CATEGORIAS_GASTO_FIJO: Array<{ value: CategoriaGastoFijo; label: string; color: string }> = [
  { value: "SUELDOS", label: "Sueldos", color: "#2f6fdb" },
  { value: "ALQUILER", label: "Alquiler", color: "#d9642a" },
  { value: "SERVICIOS", label: "Servicios", color: "#7a52d0" },
  { value: "IMPUESTOS", label: "Impuestos y tasas", color: "#1f9d6b" },
  { value: "SEGUROS", label: "Seguros", color: "#b8791b" },
  { value: "SOFTWARE", label: "Software y licencias", color: "#0e9aa7" },
  { value: "LEGAL", label: "Contable / legal", color: "#c0392b" },
  { value: "FINANCIEROS", label: "Financieros", color: "#3f8f8a" },
  { value: "AMORTIZACION", label: "Amortización", color: "#9a6b3f" },
  { value: "MARKETING", label: "Marketing", color: "#c77dab" },
  { value: "OTROS", label: "Otros", color: "#8a8a93" },
];

export const CATEGORIA_GASTO_INFO: Record<CategoriaGastoFijo, { label: string; color: string }> =
  Object.fromEntries(CATEGORIAS_GASTO_FIJO.map((c) => [c.value, { label: c.label, color: c.color }])) as Record<
    CategoriaGastoFijo,
    { label: string; color: string }
  >;

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
