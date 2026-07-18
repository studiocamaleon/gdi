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

/** Gasto estructural por centro (donut de Finanzas). */
export type CentroGastoPanel = { centroId: string; centro: string; monto: number; pct: number };

/**
 * Bloque de rentabilidad: márgenes y PUNTO DE EQUILIBRIO. Resumen trae un
 * subconjunto; Finanzas suma costos variables/fijos y el gasto por centro.
 * Deltas: ventas en % vs. período anterior; márgenes en PUNTOS. null =
 * sin comparativa (el período anterior no tuvo ventas).
 */
export type RentabilidadPanel = {
  ventas: number;
  ventasDeltaPct: number | null;
  margenBruto: number;
  margenBrutoPct: number;
  margenBrutoDeltaPts?: number | null;
  contribucion: number;
  contribucionPct: number;
  contribucionDeltaPts?: number | null;
  /** null cuando no se puede calcular (sin fijos o contribución no positiva). */
  puntoEquilibrio: number | null;
  avancePct: number | null;
  costoTotal?: number;
  costosVariables?: number;
  costosFijos?: number;
  gastoPorCentro?: CentroGastoPanel[];
};

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

/** Ventas (tab Comercial + top clientes del Resumen). */
export type RankingPanel = { id: string | null; nombre: string; ordenes: number; facturado: number };
export type MixPanel = { nombre: string; monto: number; pct: number };
export type ClienteDormidoPanel = {
  clienteId: string | null;
  cliente: string;
  ultimaCompra: string;
  diasSinComprar: number;
  historico: number;
};
export type ComercialPanel = {
  kpis: {
    ventas: number;
    ventasDeltaPct: number | null;
    ordenes: number;
    ordenesDeltaPct: number | null;
    ticketPromedio: number;
    itemsPorOrden: number;
    nuevosClientes: number;
    clientesDormidos: number;
  };
  serie: Array<{ fecha: string; monto: number }>;
  granularidad: GranularidadPanel;
  rankingClientes: RankingPanel[];
  rankingVendedores: RankingPanel[];
  mixCategoria: MixPanel[];
  mixTecnologia: MixPanel[];
  dormidos: ClienteDormidoPanel[];
};

/** Cobranza (tab Finanzas): aging, costo de cobrar, DSO, cheques, fondos. */
export type FranjaAgingPanel = "0-30" | "31-60" | "61-90" | "+90";
export type DeudorPanel = {
  clienteId: string | null;
  cliente: string;
  saldo: number;
  diasMax: number;
  porFranja: Record<FranjaAgingPanel, number>;
};
export type CostoCobrarMetodoPanel = {
  metodo: string;
  cantidad: number;
  bruto: number;
  comision: number;
  neto: number;
  pct: number;
};
export type CobranzaPanel = {
  facturado: number;
  cobrado: number;
  brecha: number;
  /** Días de facturación inmovilizados en la deuda; null si sin facturación. */
  dso: number | null;
  aging: Array<{ franja: FranjaAgingPanel; monto: number }>;
  agingTotal: number;
  vencido: number;
  deudores: DeudorPanel[];
  costoCobrar: CostoCobrarMetodoPanel[];
  comisionTotal: number;
  cheques: Array<{ estado: string; cantidad: number; importe: number; proximoVencimiento: string | null }>;
  fondos: Array<{ cuenta: string; saldo: number }>;
};

export function getPanelResumen(rango?: RangoPanel) {
  return apiRequest<
    TabPanel<{ rentabilidad: RentabilidadPanel; topClientes: RankingPanel[]; pendiente: string[] }>
  >(`/reportes/panel/resumen${qs(rango)}`);
}
export function getPanelComercial(rango?: RangoPanel) {
  return apiRequest<TabPanel<ComercialPanel>>(`/reportes/panel/comercial${qs(rango)}`);
}
export function getPanelFinanzas(rango?: RangoPanel) {
  return apiRequest<TabPanel<{ rentabilidad: RentabilidadPanel; cobranza: CobranzaPanel }>>(
    `/reportes/panel/finanzas${qs(rango)}`,
  );
}
export function getPanelProduccion(rango?: RangoPanel) {
  return apiRequest<TabPanel>(`/reportes/panel/produccion${qs(rango)}`);
}
export function getPanelProducto(rango?: RangoPanel) {
  return apiRequest<TabPanel>(`/reportes/panel/producto${qs(rango)}`);
}
