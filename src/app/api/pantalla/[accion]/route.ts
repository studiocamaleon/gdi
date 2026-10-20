import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { comprobarOrigenDeEscritura } from "@/lib/request-origin";
import {
  cabecerasBackendStaging,
  cabecerasPrivadas,
  controlAccesoStaging,
} from "@/lib/staging-access";

const COOKIE = "grafo_pantalla";
const DURACION = 180 * 24 * 60 * 60;

// Canal cerrado: nunca reenvía la sesión personal, cuerpos, rutas ni cabeceras
// elegidas por el navegador. La credencial de TV permanece en una cookie httpOnly.
async function handler(
  request: Request,
  ctx: { params: Promise<{ accion: string }> },
) {
  const denied =
    controlAccesoStaging(request.headers) ??
    comprobarOrigenDeEscritura(request);
  if (denied) return cabecerasPrivadas(denied);
  const { accion } = await ctx.params;
  const escritura = accion === "iniciar" || accion === "reiniciar";
  if (
    !["iniciar", "reiniciar", "estado", "datos"].includes(accion) ||
    request.method !== (escritura ? "POST" : "GET")
  ) {
    return cabecerasPrivadas(
      NextResponse.json({ message: "Acción no disponible." }, { status: 404 }),
    );
  }
  const jar = await cookies();
  const existente = jar.get(COOKIE)?.value;
  const nuevo = escritura && (accion === "reiniciar" || !existente);
  const token = nuevo
    ? `grafo_tv_${randomBytes(32).toString("hex")}`
    : existente;
  if (!token || !/^grafo_tv_[a-f0-9]{64}$/.test(token)) {
    return cabecerasPrivadas(
      NextResponse.json(
        { message: "Vinculá esta pantalla para continuar." },
        { status: 401 },
      ),
    );
  }
  const ruta = escritura ? (nuevo ? "iniciar" : "estado") : accion;
  try {
    const headers = new Headers({ authorization: `Bearer ${token}` });
    cabecerasBackendStaging(request.headers, headers);
    const api =
      process.env.API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:3001/api";
    const respuesta = await fetch(`${api}/pantalla-produccion/${ruta}`, {
      method: ruta === "iniciar" ? "POST" : "GET",
      headers,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(8_000)]),
    });
    const datos: unknown = await respuesta.json();
    const response = NextResponse.json(datos, { status: respuesta.status });
    if (nuevo && respuesta.ok)
      response.cookies.set(COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/pantalla",
        maxAge: DURACION,
      });
    return cabecerasPrivadas(response);
  } catch {
    return cabecerasPrivadas(
      NextResponse.json(
        { message: "No se pudo conectar con Grafo. Reintentando…" },
        { status: 503 },
      ),
    );
  }
}
export const GET = handler;
export const POST = handler;
