import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Salida de emergencia: borra la cookie y manda al login.
 *
 * Existe porque un Server Component NO puede tocar cookies, y el layout del
 * dashboard necesita justamente eso cuando el API le contesta 401: el token
 * todavía no venció por reloj —así que el proxy lo da por bueno— pero la
 * sesión detrás está revocada o borrada. Sin este paso, el layout mandaba a
 * /login, el proxy veía la cookie y rebotaba a "/", y ahí el bucle.
 *
 * Un Route Handler sí puede escribir cookies, así que la corta acá.
 */
export async function GET(request: NextRequest) {
  const parametros = new URLSearchParams();
  const motivo = request.nextUrl.searchParams.get("motivo");
  if (motivo) parametros.set("motivo", motivo);

  // En standalone request.url puede contener el host interno del contenedor.
  // Una ruta relativa conserva el origen del navegador, también detrás de Fly,
  // sin confiar en Host ni en X-Forwarded-Host aportados por el solicitante.
  // Sólo hay dos accesos propios: nunca aceptar una URL de retorno arbitraria.
  const destino =
    request.nextUrl.searchParams.get("acceso") === "plataforma"
      ? "/backoffice"
      : "/login";
  const consulta = parametros.toString();
  const response = new NextResponse(null, {
    status: 307,
    headers: {
      Location: `${destino}${consulta ? `?${consulta}` : ""}`,
      "Cache-Control": "no-store",
    },
  });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
