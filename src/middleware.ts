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

// El "home" de una sesión de plataforma: su consola. NO puede entrar a "/"
// (el dashboard del tenant), que con esa sesión tira 401 → 500.
const PLATAFORMA_HOME = "/plataforma";

/**
 * ¿El token es de una sesión de plataforma (backoffice)? Decodifica el payload
 * del JWT SIN verificar la firma — acá sólo decide a dónde rebota el middleware
 * (puro UX de ruteo). La autorización real la hacen los guards del API, que sí
 * verifican. Corre en el edge runtime: `atob`, no `Buffer`.
 */
function esSesionPlataforma(token: string): boolean {
  try {
    const seg = token.split(".")[1];
    if (!seg) return false;
    let b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(b64)) as { plat?: boolean };
    return payload?.plat === true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const { pathname } = request.nextUrl;
  const isAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));
  const isOpenPath = OPEN_PATH_RE.test(pathname);
  const esBackoffice =
    pathname === "/backoffice" || pathname.startsWith("/backoffice/");

  if (isOpenPath) {
    return NextResponse.next();
  }

  // Sesión de plataforma (backoffice): sólo vive en su consola y en su propio
  // login. Cualquier otra ruta —el dashboard del tenant, /login, /aceptar-
  // invitacion— la mandamos a /plataforma. Sin esto, /login la rebotaba a "/"
  // y el dashboard reventaba con 401 → 500 (pantalla en blanco).
  if (token && esSesionPlataforma(token)) {
    const enSuTerritorio =
      pathname === PLATAFORMA_HOME ||
      pathname.startsWith(`${PLATAFORMA_HOME}/`) ||
      esBackoffice;
    return enSuTerritorio
      ? NextResponse.next()
      : NextResponse.redirect(new URL(PLATAFORMA_HOME, request.url));
  }

  // El backoffice es OTRA superficie: accesible sin sesión de tenant (el staff
  // puede no tener empresa) y sin rebotar al que sí tiene cookie de tenant. Su
  // propia página decide qué mostrar. Ver docs/control-plane-diseno.md
  if (esBackoffice) {
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
