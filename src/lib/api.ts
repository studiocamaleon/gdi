import { getSessionToken } from "@/lib/session";
// Codec puro compartido con el API; este módulo no importa Nest ni Node.
import { restaurarJson } from "../../apps/api/src/common/json-compartido";

const DEFAULT_API_URL = "http://localhost:3001/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number, readonly retryAfterSeconds?: number) {
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
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/vnd.grafoprint.snapshot+json, application/json");
  }

  // Del lado servidor adjuntamos el token directamente (leyendo la cookie
  // httpOnly vía next/headers). Del lado cliente el token lo inyecta el proxy
  // BFF, porque la cookie httpOnly no es accesible desde JS.
  if (options?.auth !== false && typeof window === "undefined") {
    const token = await getSessionToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (typeof window === "undefined" && process.env.STAGING_PRIVATE === "true") {
    const { headers: requestHeaders } = await import("next/headers");
    const { cabecerasBackendStaging } = await import("./staging-access");
    cabecerasBackendStaging(await requestHeaders(), headers);
  }

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      cache: "no-store",
      ...init,
      headers,
      // Un redirect del API nunca debe llevar la credencial interna a otro host.
      ...(typeof window === "undefined" && process.env.STAGING_PRIVATE === "true"
        ? { redirect: "manual" as const }
        : {}),
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

    const retryAfter = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfter === null ? undefined : Number(retryAfter);
    throw new ApiError(
      message,
      response.status,
      retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds
        : undefined,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  // Algunas acciones exitosas no devuelven cuerpo, incluso con 200/201.
  // Sólo se omite el parseo si está vacío: un JSON truncado sigue siendo error.
  const body = await response.text();
  if (!body.trim()) return undefined as T;

  return restaurarJson<T>(JSON.parse(body));
}
