import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/** Sólo se importa en el servidor. Ninguna de estas variables es NEXT_PUBLIC. */
export function stagingPrivado() {
  return process.env.STAGING_PRIVATE === "true";
}

export function controlAccesoStaging(headers: Headers): Response | null {
  if (!stagingPrivado()) return null;
  const user = process.env.STAGING_ACCESS_USER;
  const password = process.env.STAGING_ACCESS_PASSWORD;
  if (!user || user.includes(":") || !password || password.length < 24) {
    return new Response("El acceso de pruebas todavía no está configurado.", {
      status: 503,
    });
  }
  const expected = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
  const supplied = headers.get("authorization") ?? "";
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(expected), hash(supplied))) {
    return new Response("Entorno de pruebas: se requiere acceso autorizado.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Grafoprint staging", charset="UTF-8"' },
    });
  }
  const origin = headers.get("origin");
  if (origin && origin !== process.env.STAGING_WEB_ORIGIN) {
    return new Response("Origen no autorizado para staging.", { status: 403 });
  }
  return null;
}

export function cabecerasPrivadas(response: Response) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** Fly es el único proxy público de esta web. No confiar en X-Forwarded-For. */
export function cabecerasBackendStaging(incoming: Headers, outgoing: Headers) {
  if (!stagingPrivado()) return;
  const denied = controlAccesoStaging(incoming);
  if (denied) throw new Error("Acceso de staging no autorizado.");
  const token = process.env.STAGING_WEB_API_TOKEN;
  const ip = incoming.get("fly-client-ip")?.trim() ?? "";
  if (!token || token.length < 32 || !isIP(ip)) {
    throw new Error("Conexión privada de staging no configurada.");
  }
  // Se construyen en el servidor; nunca copiar las cabeceras homónimas del cliente.
  outgoing.set("x-grafoprint-web-token", token);
  outgoing.set("x-grafoprint-client-ip", ip);
  outgoing.delete("x-forwarded-for");
  outgoing.delete("x-real-ip");
}
