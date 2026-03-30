import { ApiError, apiRequest } from "@/lib/api";
import { ProveedorDetalle, ProveedorPayload } from "@/lib/proveedores";

export async function getProveedores() {
  const res = await apiRequest<{ data: ProveedorDetalle[] }>("/proveedores?limit=200");
  return res.data;
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

export async function updateProveedor(id: string, payload: ProveedorPayload) {
  return apiRequest<ProveedorDetalle>(`/proveedores/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteProveedor(id: string) {
  return apiRequest<void>(`/proveedores/${id}`, {
    method: "DELETE",
  });
}
