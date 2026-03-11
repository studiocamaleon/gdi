import { ApiError, apiRequest } from "@/lib/api";
import { ClienteDetalle, ClientePayload } from "@/lib/clientes";

export async function getClientes() {
  return apiRequest<ClienteDetalle[]>("/clientes");
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
