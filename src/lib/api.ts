import { getSessionToken } from "@/lib/session";

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

  // En el navegador vamos same-origin al proxy BFF, que adjunta el token
  // desde la cookie httpOnly. El cliente nunca ve el token.
  return "/api/backend";
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  options?: { auth?: boolean },
) {
  const headers = new Headers(init?.headers ?? {});
  headers.set("Content-Type", "application/json");

  // Del lado servidor adjuntamos el token directamente (leyendo la cookie
  // httpOnly vía next/headers). Del lado cliente el token lo inyecta el proxy
  // BFF, porque la cookie httpOnly no es accesible desde JS.
  if (options?.auth !== false && typeof window === "undefined") {
    const token = await getSessionToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      cache: "no-store",
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      "No se pudo conectar con el API. Verifica que el backend este levantado y la URL configurada.",
      503,
    );
  }

  if (!response.ok) {
    let message = `Error ${response.status}: ${response.statusText || "No se pudo completar la solicitud."}`;

    try {
      const data = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(data.message)) {
        message = data.message.join(", ");
      } else if (typeof data.message === "string") {
        message = data.message;
      }
    } catch {
      try {
        const raw = await response.text();
        if (raw.trim().length > 0) {
          message = raw.trim().slice(0, 300);
        }
      } catch {}
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
