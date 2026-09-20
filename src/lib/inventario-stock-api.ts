import { apiRequest } from "@/lib/api";
import type {
  AlmacenMateriaPrima,
  KardexResponse,
  MaterialStockResumen,
  StockPageResponse,
  RegistrarMovimientoStockPayload,
  RegistrarTransferenciaStockPayload,
  StockMateriaPrimaItem,
  UbicacionAlmacenMateriaPrima,
  UpsertAlmacenPayload,
  UpsertUbicacionPayload,
} from "@/lib/inventario-stock";

export async function getAlmacenes() {
  return apiRequest<AlmacenMateriaPrima[]>("/inventario/almacenes");
}

export async function createAlmacen(payload: UpsertAlmacenPayload) {
  return apiRequest<AlmacenMateriaPrima>("/inventario/almacenes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getUbicacionesByAlmacen(almacenId: string) {
  return apiRequest<UbicacionAlmacenMateriaPrima[]>(`/inventario/almacenes/${almacenId}/ubicaciones`);
}

export async function createUbicacion(almacenId: string, payload: UpsertUbicacionPayload) {
  return apiRequest<UbicacionAlmacenMateriaPrima>(`/inventario/almacenes/${almacenId}/ubicaciones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registrarMovimientoStock(payload: RegistrarMovimientoStockPayload) {
  return apiRequest("/inventario/movimientos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registrarTransferenciaStock(payload: RegistrarTransferenciaStockPayload) {
  return apiRequest("/inventario/movimientos/transferencia", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getStockActual(params?: {
  varianteId?: string;
  materiaPrimaId?: string;
  almacenId?: string;
  ubicacionId?: string;
  soloConStock?: boolean;
}) {
  const query = new URLSearchParams();
  if (params?.varianteId) query.set("varianteId", params.varianteId);
  if (params?.materiaPrimaId) query.set("materiaPrimaId", params.materiaPrimaId);
  if (params?.almacenId) query.set("almacenId", params.almacenId);
  if (params?.ubicacionId) query.set("ubicacionId", params.ubicacionId);
  if (typeof params?.soloConStock === "boolean") {
    query.set("soloConStock", String(params.soloConStock));
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<StockMateriaPrimaItem[]>(`/inventario/stock${suffix}`);
}

export async function getKardex(
  params: {
    varianteId?: string;
    materiaPrimaId?: string;
    almacenId?: string;
    ubicacionId?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    page?: number;
    pageSize?: number;
  },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();
  if (params.varianteId) query.set("varianteId", params.varianteId);
  if (params.materiaPrimaId) query.set("materiaPrimaId", params.materiaPrimaId);
  if (params.almacenId) query.set("almacenId", params.almacenId);
  if (params.ubicacionId) query.set("ubicacionId", params.ubicacionId);
  if (params.fechaDesde) query.set("fechaDesde", params.fechaDesde);
  if (params.fechaHasta) query.set("fechaHasta", params.fechaHasta);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  return apiRequest<KardexResponse>(`/inventario/kardex?${query.toString()}`, {
    signal,
  });
}

export async function getStockPage(
  params: {
    varianteId?: string;
    materiaPrimaId?: string;
    almacenId?: string;
    ubicacionId?: string;
    soloConStock?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return apiRequest<StockPageResponse>(`/inventario/stock/pagina?${query}`, {
    signal,
  });
}

export function getResumenStockMaterial(id: string, signal?: AbortSignal) {
  return apiRequest<MaterialStockResumen[]>(
    `/inventario/stock/resumen-material/${id}`,
    { signal },
  );
}
