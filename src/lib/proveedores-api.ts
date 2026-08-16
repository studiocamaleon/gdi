import { ApiError, apiRequest } from "@/lib/api";
import {
  ProveedorDetalle,
  ProveedorOpcion,
  ProveedorPayload,
} from "@/lib/proveedores";

export async function getProveedores() {
  return apiRequest<ProveedorOpcion[]>("/proveedores/opciones");
}

export type ProveedoresListResponse = {
  data: ProveedorDetalle[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export async function listProveedores(params?: {
  q?: string;
  page?: number;
  limit?: number;
  incluirInactivos?: boolean;
}) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.incluirInactivos) query.set("incluirInactivos", "true");
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiRequest<ProveedoresListResponse>(`/proveedores${suffix}`);
}

export async function getProveedorById(id: string) {
  try {
    return await apiRequest<ProveedorDetalle>(`/proveedores/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function createProveedor(payload: ProveedorPayload) {
  return apiRequest<ProveedorDetalle>("/proveedores", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProveedor(
  id: string,
  payload: ProveedorPayload & { updatedAt: string },
) {
  return apiRequest<ProveedorDetalle>(`/proveedores/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function importarProveedores(proveedores: ProveedorPayload[]) {
  return apiRequest<{ data: ProveedorDetalle[]; total: number }>(
    "/proveedores/importar",
    {
      method: "POST",
      body: JSON.stringify({ proveedores }),
    },
  );
}

export async function setProveedorActivo(id: string, activo: boolean) {
  return apiRequest<ProveedorDetalle>(`/proveedores/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ activo }),
  });
}

export async function deleteProveedor(id: string) {
  return apiRequest<void>(`/proveedores/${id}`, {
    method: "DELETE",
  });
}
