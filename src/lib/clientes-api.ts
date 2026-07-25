import { ApiError, apiRequest } from "@/lib/api";
import { ClienteDetalle, ClientePayload } from "@/lib/clientes";

type ClientesQuery = {
  q?: string;
  page?: number;
  limit?: number;
  /**
   * Traer también los inhabilitados. Sólo lo pide la pantalla de Clientes
   * cuando alguien lo marca: en el resto del sistema —selectores del cotizador,
   * buscadores— un inhabilitado no tiene que aparecer.
   */
  incluirInactivos?: boolean;
};

export type ClientesListResponse = {
  data: ClienteDetalle[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

function buildClientesPath(params: ClientesQuery = {}) {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit ?? 200));
  if (params.page) searchParams.set("page", String(params.page));
  if (params.q?.trim()) searchParams.set("q", params.q.trim());
  if (params.incluirInactivos) searchParams.set("incluirInactivos", "true");
  return `/clientes?${searchParams.toString()}`;
}

export async function listClientes(params: ClientesQuery = {}) {
  return apiRequest<ClientesListResponse>(buildClientesPath(params));
}

export async function getClientes(params: ClientesQuery = {}) {
  const res = await listClientes(params);
  return res.data;
}

export async function getClienteById(id: string) {
  try {
    return await apiRequest<ClienteDetalle>(`/clientes/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function createCliente(payload: ClientePayload) {
  return apiRequest<ClienteDetalle>("/clientes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCliente(id: string, payload: ClientePayload) {
  return apiRequest<ClienteDetalle>(`/clientes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCliente(id: string) {
  return apiRequest<void>(`/clientes/${id}`, {
    method: "DELETE",
  });
}

/**
 * Inhabilitar o volver a habilitar. Es la salida para el cliente que ya operó:
 * borrarlo dejaría sus órdenes sin dueño.
 */
export async function toggleCliente(id: string) {
  return apiRequest<ClienteDetalle>(`/clientes/${id}/toggle`, {
    method: "PATCH",
  });
}
