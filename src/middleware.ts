// OJO dónde vive este archivo: con estructura `src/`, Next SÓLO ejecuta el
// middleware desde `src/middleware.ts`. Estuvo meses en la raíz del proyecto
// sin correr nunca — todo lo que "protegía" lo estaban protegiendo en
// realidad los layouts (redirect del dashboard) y los 401 del API. Se
// descubrió cuando /plataforma devolvió 500 en vez de rebotar a /login.
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session";

// Páginas de autenticación: accesibles sin sesión y, si ya hay sesión, se
// rebota al home (no tiene sentido re-loguearse).
const AUTH_PATHS = ["/login", "/aceptar-invitacion"];
// Contenido ABIERTO: accesible por cualquiera con o sin sesión (no rebota al
// usuario logueado). Son los links públicos: /t/ seguimiento, /p/ presupuesto,
// /f/ factura, /r/ remito, /c/ cobro, /e/ encuesta — más las dos rutas viejas
// (/track, /presupuesto) que todavía redirigen.
//
// Se matchea con regex ANCLADA, no con startsWith: `startsWith("/p")` dejaría
// abiertas /panel, /produccion y /presupuestos del dashboard. La ruta pública
// es exactamente prefijo + token, nada más.
// Ver docs/enlaces-publicos-diseno.md
const OPEN_PATH_RE = /^\/(?:[tpfrce]|track|presupuesto)\/[A-Za-z0-9_-]+\/?$/;

export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const { pathname } = request.nextUrl;
  const isAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));
  const isOpenPath = OPEN_PATH_RE.test(pathname);

  if (isOpenPath) {
    return NextResponse.next();
  }

  if (!token && !isAuthPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && isAuthPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand|api).*)"],
};
