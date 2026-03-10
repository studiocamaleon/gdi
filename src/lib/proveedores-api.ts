import { ProveedorDetalle, ProveedorPayload } from "@/lib/proveedores";

const DEFAULT_API_URL = "http://localhost:3001/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getApiBaseUrl() {
  if (typeof window === "undefined") {
    return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
  }

  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = "No se pudo completar la solicitud.";

    try {
      const data = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(data.message)) {
        message = data.message.join(", ");
      } else if (typeof data.message === "string") {
        message = data.message;
      }
    } catch {}

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getProveedores() {
  return request<ProveedorDetalle[]>("/proveedores");
}

export async function getProveedorById(id: string) {
  try {
    return await request<ProveedorDetalle>(`/proveedores/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function createProveedor(payload: ProveedorPayload) {
  return request<ProveedorDetalle>("/proveedores", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProveedor(id: string, payload: ProveedorPayload) {
  return request<ProveedorDetalle>(`/proveedores/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteProveedor(id: string) {
  return request<void>(`/proveedores/${id}`, {
    method: "DELETE",
  });
}
