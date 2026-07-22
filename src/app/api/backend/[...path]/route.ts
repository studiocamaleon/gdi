import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "@/lib/session";

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
  const { path } = await ctx.params;
  const { search } = new URL(request.url);
  const target = `${backendBaseUrl()}/${path.join("/")}${search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  let response: Response;
  try {
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
    });
  } catch {
    return new Response(
      JSON.stringify({ message: "No se pudo conectar con el API." }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  const responseHeaders = new Headers();
  const respContentType = response.headers.get("content-type");
  if (respContentType) {
    responseHeaders.set("content-type", respContentType);
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
