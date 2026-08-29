import { apiRequest } from "@/lib/api";
import type {
  OrdenesTrabajoStats,
  OrdenTrabajoDetalle,
  OrdenTrabajoListItem,
} from "@/lib/ordenes-trabajo";
import type {
  TableroItemData,
  TableroPasoAccion,
  TableroProduccionData,
} from "@/lib/tablero-produccion";

/**
 * Cliente API de Órdenes de Trabajo. El backend implementa el contrato de
 * `src/lib/ordenes-trabajo.ts` tal cual (ver
 * docs/ordenes-trabajo-persistencia-diseno.md).
 */

export type CrearOrdenTrabajoItemPayload = {
  cotizacionItemId?: string;
  /**
   * Descuento comercial de la línea (F1 descuentos). `tipo`/`valor` = lo que
   * pidió el vendedor; `monto` = lo que resolvió el motor (ya restado dentro de
   * `subtotal`, no se descuenta de nuevo). Ver docs/descuentos-diseno.md §10.
   */
  descuentoTipo?: "PORCENTAJE" | "MONTO" | null;
  descuentoValor?: number | null;
  descuentoMonto?: number | null;
  /** Cupón que originó el descuento (F4): se redime al emitir. */
  descuentoCuponId?: string | null;
  codigo: string;
  nombre: string;
  familia: string;
  categoriaComercial?: string;
  subcategoriaComercial?: string;
  cantidad: number;
  cantidadUnidad: string;
  /** Vista previa de UI. La API de OT los reemplaza por el snapshot cotizado. */
  subtotal: number;
  impuestos: number;
  total: number;
  specs?: Array<{ etiqueta: string; valor: string }>;
  adicionales?: string[];
};

export type CrearOrdenTrabajoPayload = {
  /** UUID estable durante los reintentos de una misma creación. */
  idempotencyKey?: string;
  clienteId?: string;
  vendedorEmpleadoId?: string;
  cotizacionId?: string;
  proyectoCampanaId?: string;
  /** borrador (guardar) o pendiente (emitir al taller). */
  estado?: "borrador" | "pendiente";
  /** ISO date (YYYY-MM-DD). */
  fechaEntrega?: string;
  canalVenta?: string;
  observaciones?: string;
  /** Sólo compatibilidad con presupuestos históricos; una OT nueva usa `cargos`. */
  cargosDirectos?: number;
  /** Sin comprobante fiscal desde el vamos (§6 cuaderno de margen). */
  tratamientoFiscal?: "FISCAL" | "SIN_COMPROBANTE";
  /** Puntos enteros a aplicar como bonificación comercial. */
  fidelizacionCanjePuntos?: number;
  /** Inputs comerciales; nombres, configuración derivada e importes los resuelve la API. */
  cargos?: Array<{
    cargoDirectoCatalogoId: string;
    configInput: Record<string, unknown>;
    cantidadInput?: number;
    montoNeto: number;
    nota?: string;
  }>;
  items: CrearOrdenTrabajoItemPayload[];
};

type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type OrdenesTrabajoListado = PaginatedResponse<OrdenTrabajoListItem> & {
  stats: OrdenesTrabajoStats;
};

export async function getOrdenesTrabajo(params?: {
  estado?: string;
  urgencia?: "atrasadas";
  q?: string;
  clienteId?: string;
  proyectoCampanaId?: string;
  page?: number;
  limit?: number;
}): Promise<OrdenesTrabajoListado> {
  const search = new URLSearchParams();
  if (params?.estado) search.set("estado", params.estado);
  if (params?.urgencia) search.set("urgencia", params.urgencia);
  if (params?.q) search.set("q", params.q);
  if (params?.clienteId) search.set("clienteId", params.clienteId);
  if (params?.proyectoCampanaId)
    search.set("proyectoCampanaId", params.proyectoCampanaId);
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

export type EditarOrdenTrabajoLotePayload = EditarOrdenTrabajoPayload & {
  expectedVersion: string;
  /** Conjunto final completo; con `id` actualiza, sin `id` crea. */
  items?: Array<
    CrearOrdenTrabajoItemPayload & {
      id?: string;
      archivosOrigenItemIds?: string[];
    }
  >;
};

export async function editarOrdenTrabajoLote(
  id: string,
  payload: EditarOrdenTrabajoLotePayload,
): Promise<OrdenTrabajoDetalle> {
  return apiRequest<OrdenTrabajoDetalle>(`/ordenes-trabajo/${id}/lote`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Enciende/apaga el tratamiento SIN comprobante fiscal de la orden (§6 del
 *  cuaderno de margen). Devuelve la orden con los totales recalculados. */
export async function setTratamientoFiscalOrden(
  id: string,
  tratamientoFiscal: "FISCAL" | "SIN_COMPROBANTE",
): Promise<OrdenTrabajoDetalle> {
  return apiRequest<OrdenTrabajoDetalle>(
    `/ordenes-trabajo/${id}/tratamiento-fiscal`,
    {
      method: "PATCH",
      body: JSON.stringify({ tratamientoFiscal }),
    },
  );
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

/** Dataset autorizado del Tablero: items activos visibles para el perfil. */
export async function getTableroProduccion(): Promise<TableroProduccionData> {
  return apiRequest<TableroProduccionData>("/ordenes-trabajo/tablero");
}

/** Pasos materializados de UNA orden (tab Producción del detalle de OT). */
export async function getOrdenPasos(
  ordenId: string,
): Promise<{ items: TableroItemData[] }> {
  return apiRequest<{ items: TableroItemData[] }>(
    `/ordenes-trabajo/${ordenId}/pasos`,
  );
}

/**
 * Señal cliente: los tramos del usuario cambiaron por una acción propia.
 * El widget flotante "En curso" la escucha para refrescar al instante en
 * vez de esperar su próximo poll (~30 s).
 */
export const TRAMOS_CAMBIARON_EVENT = "gdi:tramos-cambiaron";

function avisarTramosCambiaron() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TRAMOS_CAMBIARON_EVENT));
  }
}

/** Acción de ejecución sobre un paso; devuelve el item re-proyectado. */
export async function accionPasoProduccion(
  ordenId: string,
  itemId: string,
  pasoId: string,
  payload: {
    accion: TableroPasoAccion;
    /** Bloquear: texto libre. Pausar: código de MOTIVOS_PAUSA. */
    motivo?: string;
    /** Texto libre cuando el motivo de pausa es "otro". */
    motivoDetalle?: string;
    /** Completar con tiempo medido inválido: cuánto llevó aprox (D8). */
    tiempoDeclaradoMin?: number;
  },
): Promise<TableroItemData> {
  const item = await apiRequest<TableroItemData>(
    `/ordenes-trabajo/${ordenId}/items/${itemId}/pasos/${pasoId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  avisarTramosCambiaron();
  return item;
}

/**
 * Panel de Compras (F2): avanza el estado de una compra tercerizada
 * (pendiente → pedido → recibido → entregado).
 */
export async function avanzarCompraProduccion(
  pasoId: string,
  estadoCompra: string,
): Promise<{ ok: boolean; pasoId: string; estadoCompra: string }> {
  return apiRequest(`/ordenes-trabajo/tablero/pasos/${pasoId}/compra`, {
    method: "PATCH",
    body: JSON.stringify({ estadoCompra }),
  });
}

/**
 * Completar varios pasos de una (simulador de impresión): resultado
 * PARCIAL honesto — los que no pudieron, con su motivo. `duracionTandaMin`
 * (opcional) prorratea la duración real de la tanda entre los pasos (D11).
 */
/**
 * Ahorro de material concretado al consolidar la tanda (simulador gran
 * formato): se persiste como valor generado por el sistema y alimenta el
 * acumulado de Reportes.
 */
export type AhorroConsolidacionPayload = {
  varianteId: string;
  anchoMm: number;
};

export async function completarPasosLote(
  pasoIds: string[],
  duracionTandaMin?: number,
  ahorro?: AhorroConsolidacionPayload,
  validarCompatibilidadLaser?: boolean,
) {
  const resultado = await apiRequest<{
    completados: number;
    errores: Array<{ pasoId: string; motivo: string }>;
  }>("/ordenes-trabajo/tablero/pasos/completar-lote", {
    method: "POST",
    body: JSON.stringify({
      pasoIds,
      duracionTandaMin,
      ahorro,
      validarCompatibilidadLaser,
    }),
  });
  avisarTramosCambiaron();
  return resultado;
}

/** Tramos de trabajo abiertos del usuario (widget flotante "En curso"). */
export type MisTramosAbiertos = {
  tramos: Array<{
    id: string;
    pasoId: string;
    ordenId: string;
    itemId: string;
    pasoNombre: string;
    itemNombre: string;
    ordenNumero: string;
    clienteNombre: string;
    /** ISO datetime. */
    inicioEl: string;
    duracionEstimadaMin: number | null;
    /** Minutos ya trabajados en tramos anteriores (cerrados) del paso. */
    acumuladoPrevioMin: number;
  }>;
};

export async function getMisTramosAbiertos(): Promise<MisTramosAbiertos> {
  return apiRequest<MisTramosAbiertos>("/ordenes-trabajo/tablero/mis-tramos");
}

/** Pausa automática por inactividad (D13): sin respuesta al countdown. */
export async function autoPausarPaso(pasoId: string): Promise<TableroItemData> {
  const item = await apiRequest<TableroItemData>(
    `/ordenes-trabajo/tablero/pasos/${pasoId}/auto-pausa`,
    { method: "PATCH" },
  );
  avisarTramosCambiaron();
  return item;
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

/**
 * Cancelar la orden. Endpoint aparte del cambio de estado porque no es una
 * etapa más: pide motivo, frena si hay factura emitida y cierra lo que quedó
 * abierto en el taller.
 */
export async function cancelarOrdenTrabajo(
  id: string,
  motivo: string,
  /** Acreditar las facturas vivas y cancelar en un solo acto. */
  emitirNotaCredito = false,
): Promise<OrdenTrabajoDetalle> {
  return apiRequest<OrdenTrabajoDetalle>(`/ordenes-trabajo/${id}/cancelar`, {
    method: "POST",
    body: JSON.stringify({ motivo, emitirNotaCredito }),
  });
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
