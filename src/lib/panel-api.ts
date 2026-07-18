import { apiRequest } from "@/lib/api";

/**
 * Panel general (Inteligencia de negocio) — contrato con /reportes/panel.
 * Cimientos: tipos compartidos (rango, meta honesta) y un fetch por tab.
 * Los payloads de cada tab se completan a medida que aterriza su service
 * de dominio. Ver docs/reportes-plan-backend.md
 */

export type GranularidadPanel = "dia" | "semana" | "mes";

/** La honestidad viaja del backend: fuente, límites y si hay comparativa. */
export type MetaPanel = {
  fuente: string;
  limites: string[];
  sinComparativa: boolean;
  rango: { desde: string; hasta: string };
  rangoAnterior: { desde: string; hasta: string };
  granularidad: GranularidadPanel;
};

export type RangoPanel = { desde?: string; hasta?: string };

/** Respuesta base de un tab (mientras se construye, `pendiente: true`). */
export type TabPanel<T = Record<string, never>> = {
  meta: MetaPanel;
  pendiente?: boolean;
} & Partial<T>;

function qs(rango?: RangoPanel): string {
  const params = new URLSearchParams();
  if (rango?.desde) params.set("desde", rango.desde);
  if (rango?.hasta) params.set("hasta", rango.hasta);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function getPanelResumen(rango?: RangoPanel) {
  return apiRequest<TabPanel>(`/reportes/panel/resumen${qs(rango)}`);
}
export function getPanelComercial(rango?: RangoPanel) {
  return apiRequest<TabPanel>(`/reportes/panel/comercial${qs(rango)}`);
}
export function getPanelFinanzas(rango?: RangoPanel) {
  return apiRequest<TabPanel>(`/reportes/panel/finanzas${qs(rango)}`);
}
export function getPanelProduccion(rango?: RangoPanel) {
  return apiRequest<TabPanel>(`/reportes/panel/produccion${qs(rango)}`);
}
export function getPanelProducto(rango?: RangoPanel) {
  return apiRequest<TabPanel>(`/reportes/panel/producto${qs(rango)}`);
}
