import { apiRequest, ApiError } from "@/lib/api";
import type {
  InstallMaterialPresetPayload,
  InstallMaterialPresetResponse,
  MaterialPresetDetail,
  MaterialPresetListItem,
} from "@/lib/biblioteca-materias-primas";
import type {
  MateriaPrima,
  MateriaPrimaPayload,
  UpdateVariantePrecioReferenciaPayload,
} from "@/lib/materias-primas";

export interface MateriasPrimasListResponse {
  data: MateriaPrima[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Listado paginado (envelope) del backend. */
export async function listMateriasPrimas(
  params: { page?: number; limit?: number; search?: string } = {},
): Promise<MateriasPrimasListResponse> {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.search?.trim()) sp.set("search", params.search.trim());
  const qs = sp.toString();
  return apiRequest<MateriasPrimasListResponse>(
    `/inventario/materias-primas${qs ? `?${qs}` : ""}`,
  );
}

/**
 * Devuelve TODAS las materias primas (recorriendo páginas). El backend acota
 * cada query por límite; los consumidores (panel, pickers) siguen recibiendo
 * el array completo sin cambios.
 */
export async function getMateriasPrimas(): Promise<MateriaPrima[]> {
  const limit = 200;
  const all: MateriaPrima[] = [];
  let page = 1;
  for (;;) {
    const res = await listMateriasPrimas({ page, limit });
    all.push(...res.data);
    if (page >= res.pages || res.data.length === 0) break;
    page += 1;
  }
  return all;
}

export async function getMateriaPrimaById(id: string) {
  try {
    return await apiRequest<MateriaPrima>(`/inventario/materias-primas/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function createMateriaPrima(payload: MateriaPrimaPayload) {
  return apiRequest<MateriaPrima>("/inventario/materias-primas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMateriaPrima(id: string, payload: MateriaPrimaPayload) {
  return apiRequest<MateriaPrima>(`/inventario/materias-primas/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function toggleMateriaPrima(id: string) {
  return apiRequest<MateriaPrima>(`/inventario/materias-primas/${id}/toggle`, {
    method: "PATCH",
  });
}

export async function getBibliotecaMateriasPrimas() {
  return apiRequest<MaterialPresetListItem[]>("/inventario/materias-primas/biblioteca");
}

export async function getBibliotecaMateriaPrimaByKey(key: string) {
  return apiRequest<MaterialPresetDetail>(`/inventario/materias-primas/biblioteca/${key}`);
}

export async function instalarBibliotecaMateriaPrima(
  key: string,
  payload: InstallMaterialPresetPayload,
) {
  return apiRequest<InstallMaterialPresetResponse>(
    `/inventario/materias-primas/biblioteca/${key}/instalar`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateVariantePrecioReferencia(
  varianteId: string,
  payload: UpdateVariantePrecioReferenciaPayload,
) {
  return apiRequest<{
    varianteId: string;
    precioReferencia: number;
    moneda: string;
    updatedAt: string;
  }>(`/inventario/materias-primas/variantes/${varianteId}/precio-referencia`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
