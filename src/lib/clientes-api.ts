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
  searchParams.set("limit", String(params.limit ?? 25));
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

export async function updateCliente(
  id: string,
  payload: ClientePayload,
  updatedAt: string,
) {
  return apiRequest<ClienteDetalle>(`/clientes/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ...payload, updatedAt }),
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
export async function setClienteActivo(id: string, activo: boolean) {
  return apiRequest<ClienteDetalle>(`/clientes/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ activo }),
  });
}

export async function importarClientes(clientes: ClientePayload[]) {
  return apiRequest<{ data: ClienteDetalle[]; total: number }>(
    "/clientes/importar",
    { method: "POST", body: JSON.stringify({ clientes }) },
  );
}

/**
 * Alta rápida escaneando el DNI en el mostrador. Si ese documento ya existe
 * en el tenant devuelve el cliente que hay (`yaExistia`), sin duplicarlo ni
 * pisarle los datos que alguien haya completado después.
 */
export async function altaClientePorDocumento(payload: {
  nombre: string;
  documento: string;
  cuit?: string;
  telefonoCodigo?: string;
  telefonoNumero?: string;
}) {
  return apiRequest<{ cliente: ClienteDetalle; yaExistia: boolean }>(
    "/clientes/alta-por-documento",
    { method: "POST", body: JSON.stringify(payload) },
  );
}

/**
 * Un cliente quedó identificado escaneando su DNI.
 *
 * El modal de alta vive en el layout —el lector funciona desde cualquier
 * pantalla— así que no puede hablarle por props a la ficha que el operador
 * tenga abierta. Va por evento: quien esté cargando una orden lo escucha y
 * se lo pone como cliente. Mismo patrón que TRAMOS_CAMBIARON_EVENT.
 */
export const CLIENTE_ESCANEADO_EVENT = "gdi:cliente-escaneado";

export function avisarClienteEscaneado(cliente: ClienteDetalle) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ClienteDetalle>(CLIENTE_ESCANEADO_EVENT, {
      detail: cliente,
    }),
  );
}

/** ¿Ese documento ya está cargado? Se consulta al escanear, antes del alta. */
export async function buscarClientePorDocumento(documento: string) {
  return apiRequest<{ cliente: ClienteDetalle | null }>(
    `/clientes/por-documento/${encodeURIComponent(documento)}`,
  );
}
