import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "@/lib/session";
import { cabecerasBackendStaging, cabecerasPrivadas, controlAccesoStaging, stagingPrivado } from "@/lib/staging-access";
import {
  MFA_COOKIES,
  MFA_HEADERS,
  MFA_RECORDADO_HEADER,
  MFA_DISPOSITIVO_MAX_AGE,
} from "../../../../../apps/api/src/auth/mfa-dispositivo-cookie";

const DEFAULT_API_URL = "http://localhost:3001/api";

function backendBaseUrl() {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL
  );
}

/**
 * Proxy Backend-for-Frontend. Las llamadas del navegador van same-origin a
 * /api/backend/*; este handler lee la cookie de sesión httpOnly del lado
 * servidor y reenvía la request al backend Nest con el header Authorization.
 * Así el token nunca es legible por JS en el cliente (defensa contra XSS).
 */
async function handler(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const denied = controlAccesoStaging(request.headers);
  if (denied) return cabecerasPrivadas(denied);
  const { path } = await ctx.params;
  const { search } = new URL(request.url);
  const target = `${backendBaseUrl()}/${path.join("/")}${search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const lastEventId = request.headers.get("last-event-id");
  if (lastEventId) {
    headers.set("last-event-id", lastEventId);
  }
  const accept = request.headers.get("accept");
  if (accept) {
    headers.set("accept", accept);
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const ruta = path.join("/");
  if (
    ["auth/login", "auth/login-plataforma", "auth/mfa/verificar"].includes(ruta)
  ) {
    for (const alcance of ["tenant", "plataforma"] as const) {
      const dispositivo = cookieStore.get(MFA_COOKIES[alcance])?.value;
      if (dispositivo && /^[a-f0-9]{64}$/.test(dispositivo))
        headers.set(MFA_HEADERS[alcance], dispositivo);
    }
  }

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  let response: Response;
  try {
    cabecerasBackendStaging(request.headers, headers);
    response = await fetch(target, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      // Sin esto, `fetch` sigue el redirect ACÁ DENTRO: la descarga de un
      // archivo se resolvería en el proceso de Next y volveríamos a bufferear
      // el contenido entero en memoria, que es justo lo que evita el 302 a la
      // URL firmada del storage. Se propaga el Location y que lo siga el
      // navegador. Ver docs/archivos-r2-diseno.md §D4.
      redirect: "manual",
      signal: request.signal,
    });
  } catch {
    return new Response(
      JSON.stringify({ message: "No se pudo conectar con el API." }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  if (response.ok && ruta === "auth/mfa/verificar") {
    const raw = response.headers.get(MFA_RECORDADO_HEADER);
    if (raw) {
      let recordado: { token?: unknown; alcance?: unknown } | null = null;
      try {
        recordado = JSON.parse(raw);
      } catch {
        // La sesión puede continuar, pero un encabezado inválido nunca crea confianza.
      }
      if (
        recordado &&
        typeof recordado.token === "string" &&
        /^[a-f0-9]{64}$/.test(recordado.token) &&
        (recordado.alcance === "tenant" || recordado.alcance === "plataforma")
      ) {
        cookieStore.set(MFA_COOKIES[recordado.alcance], recordado.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: MFA_DISPOSITIVO_MAX_AGE,
        });
      }
    }
  }
  if (
    response.ok &&
    method === "DELETE" &&
    ruta === "auth/perfil/mfa/dispositivos"
  ) {
    for (const nombre of Object.values(MFA_COOKIES)) cookieStore.delete(nombre);
  }

  const responseHeaders = new Headers();
  if (stagingPrivado()) {
    responseHeaders.set("x-robots-tag", "noindex, nofollow, noarchive");
    responseHeaders.set("cache-control", "private, no-store");
  }
  const cacheControl = response.headers.get("cache-control");
  if (cacheControl && !stagingPrivado()) responseHeaders.set("cache-control", cacheControl);
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) responseHeaders.set("retry-after", retryAfter);
  const respContentType = response.headers.get("content-type");
  if (respContentType) {
    responseHeaders.set("content-type", respContentType);
  }

  // SSE no puede pasar por el buffer general del BFF: la conexión debe quedar
  // abierta y cada evento tiene que llegar al navegador apenas lo emite Nest.
  if (respContentType?.includes("text/event-stream")) {
    responseHeaders.set("cache-control", "no-cache, no-transform");
    responseHeaders.set("connection", "keep-alive");
    responseHeaders.set("x-accel-buffering", "no");
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  }
  // Sin esto, un archivo (el PDF de un comprobante) llega sin su nombre y el
  // navegador lo baja como "path" o similar.
  const disposition = response.headers.get("content-disposition");
  if (disposition) {
    responseHeaders.set("content-disposition", disposition);
  }

  const status = response.status;

  // Redirect: se reenvía tal cual, con el Location, para que lo siga el
  // navegador. El body de un 3xx no interesa.
  const location = response.headers.get("location");
  if (status >= 300 && status < 400 && location) {
    responseHeaders.set("location", location);
    return new Response(null, { status, headers: responseHeaders });
  }

  // 204/304 no pueden llevar body: construir Response con body nulo, o el
  // constructor lanza y el proxy devolvería 500 (rompía todos los DELETE).
  const body =
    status === 204 || status === 304 ? null : await response.arrayBuffer();

  return new Response(body, {
    status,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
