import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Salida de emergencia: borra la cookie y manda al login.
 *
 * Existe porque un Server Component NO puede tocar cookies, y el layout del
 * dashboard necesita justamente eso cuando el API le contesta 401: el token
 * todavía no venció por reloj —así que el middleware lo da por bueno— pero la
 * sesión detrás está revocada o borrada. Sin este paso, el layout mandaba a
 * /login, el middleware veía la cookie y rebotaba a "/", y ahí el bucle.
 *
 * Un Route Handler sí puede escribir cookies, así que la corta acá.
 */
export async function GET(request: NextRequest) {
  const destino = new URL("/login", request.url);
  const motivo = request.nextUrl.searchParams.get("motivo");
  if (motivo) destino.searchParams.set("motivo", motivo);

  const response = NextResponse.redirect(destino);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
