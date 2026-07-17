import { apiRequest } from "@/lib/api";
import type {
  OrdenesTrabajoStats,
  OrdenTrabajoDetalle,
  OrdenTrabajoListItem,
} from "@/lib/ordenes-trabajo";
import type {
  TableroItemData,
  TableroPasoAccion,
} from "@/lib/tablero-produccion";

/**
 * Cliente API de Órdenes de Trabajo. El backend implementa el contrato de
 * `src/lib/ordenes-trabajo.ts` tal cual (ver
 * docs/ordenes-trabajo-persistencia-diseno.md).
 */

export type CrearOrdenTrabajoItemPayload = {
  cotizacionItemId?: string;
  codigo: string;
  nombre: string;
  familia: string;
  categoriaComercial?: string;
  subcategoriaComercial?: string;
  cantidad: number;
  cantidadUnidad: string;
  subtotal: number;
  impuestos: number;
  total: number;
  specs?: Array<{ etiqueta: string; valor: string }>;
  adicionales?: string[];
};

export type CrearOrdenTrabajoPayload = {
  clienteId?: string;
  vendedorEmpleadoId?: string;
  cotizacionId?: string;
  /** borrador (guardar) o pendiente (emitir al taller). */
  estado?: "borrador" | "pendiente";
  /** ISO date (YYYY-MM-DD). */
  fechaEntrega?: string;
  canalVenta?: string;
  observaciones?: string;
  cargosDirectos?: number;
  items: CrearOrdenTrabajoItemPayload[];
};

type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type OrdenesTrabajoListado =
  PaginatedResponse<OrdenTrabajoListItem> & {
    stats: OrdenesTrabajoStats;
  };

export async function getOrdenesTrabajo(params?: {
  estado?: string;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<OrdenesTrabajoListado> {
  const search = new URLSearchParams();
  if (params?.estado) search.set("estado", params.estado);
  if (params?.q) search.set("q", params.q);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiRequest<OrdenesTrabajoListado>(
    `/ordenes-trabajo${query ? `?${query}` : ""}`,
  );
}

export async function getOrdenTrabajo(
  id: string,
): Promise<OrdenTrabajoDetalle> {
  return apiRequest<OrdenTrabajoDetalle>(`/ordenes-trabajo/${id}`);
}

export async function crearOrdenTrabajo(
  payload: CrearOrdenTrabajoPayload,
): Promise<OrdenTrabajoDetalle> {
  return apiRequest<OrdenTrabajoDetalle>("/ordenes-trabajo", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type EditarOrdenTrabajoPayload = {
  clienteId?: string;
  vendedorEmpleadoId?: string;
  canalVenta?: string;
  /** ISO date (YYYY-MM-DD). */
  fechaEntrega?: string;
  observaciones?: string;
};

export async function editarOrdenTrabajo(
  id: string,
  payload: EditarOrdenTrabajoPayload,
): Promise<OrdenTrabajoDetalle> {
  return apiRequest<OrdenTrabajoDetalle>(`/ordenes-trabajo/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function agregarOrdenItem(
  ordenId: string,
  payload: CrearOrdenTrabajoItemPayload,
): Promise<OrdenTrabajoDetalle> {
  return apiRequest<OrdenTrabajoDetalle>(`/ordenes-trabajo/${ordenId}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function editarOrdenItem(
  ordenId: string,
  itemId: string,
  payload: CrearOrdenTrabajoItemPayload,
): Promise<OrdenTrabajoDetalle> {
  return apiRequest<OrdenTrabajoDetalle>(
    `/ordenes-trabajo/${ordenId}/items/${itemId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function quitarOrdenItem(
  ordenId: string,
  itemId: string,
): Promise<OrdenTrabajoDetalle> {
  return apiRequest<OrdenTrabajoDetalle>(
    `/ordenes-trabajo/${ordenId}/items/${itemId}`,
    { method: "DELETE" },
  );
}

/** Dataset completo del Tablero: items de órdenes activas con sus pasos. */
export async function getTableroProduccion(): Promise<{
  items: TableroItemData[];
}> {
  return apiRequest<{ items: TableroItemData[] }>("/ordenes-trabajo/tablero");
}

/** Acción de ejecución sobre un paso; devuelve el item re-proyectado. */
export async function accionPasoProduccion(
  ordenId: string,
  itemId: string,
  pasoId: string,
  payload: { accion: TableroPasoAccion; motivo?: string },
): Promise<TableroItemData> {
  return apiRequest<TableroItemData>(
    `/ordenes-trabajo/${ordenId}/items/${itemId}/pasos/${pasoId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

/**
 * Completar varios pasos de una (simulador de impresión): resultado
 * PARCIAL honesto — los que no pudieron, con su motivo.
 */
export async function completarPasosLote(pasoIds: string[]) {
  return apiRequest<{ completados: number; errores: Array<{ pasoId: string; motivo: string }> }>(
    "/ordenes-trabajo/tablero/pasos/completar-lote",
    { method: "POST", body: JSON.stringify({ pasoIds }) },
  );
}

/** Tomar/soltar un paso de MI mesa de trabajo (vista Por estación). */
export async function mesaPasoProduccion(
  pasoId: string,
  en: boolean,
): Promise<TableroItemData> {
  return apiRequest<TableroItemData>(
    `/ordenes-trabajo/tablero/pasos/${pasoId}/mesa`,
    { method: "PATCH", body: JSON.stringify({ en }) },
  );
}

export async function cambiarEstadoOrdenTrabajo(
  id: string,
  payload: {
    estado: "pendiente" | "produccion" | "finalizada" | "entregada";
    progresoPct?: number;
  },
): Promise<OrdenTrabajoDetalle> {
  return apiRequest<OrdenTrabajoDetalle>(`/ordenes-trabajo/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
