// OJO dónde vive este archivo: con estructura `src/`, Next SÓLO lo ejecuta
// desde `src/proxy.ts`. Estuvo meses en la raíz del proyecto (y con el nombre
// viejo, `middleware.ts`) sin correr nunca — todo lo que "protegía" lo estaban
// protegiendo en realidad los layouts (redirect del dashboard) y los 401 del
// API. Se descubrió cuando /plataforma devolvió 500 en vez de rebotar a /login.
//
// Se llamaba `middleware` hasta Next 16, que renombró la convención a `proxy`:
// mismo comportamiento, otro nombre de archivo y de función.
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session";

// Páginas de autenticación: accesibles sin sesión y, si ya hay sesión, se
// rebota al home (no tiene sentido re-loguearse).
const AUTH_PATHS = ["/login", "/aceptar-invitacion"];
// La salida de emergencia: borra la cookie y manda al login. Tiene que pasar
// SIEMPRE, con cookie o sin ella, o el bucle que viene a cortar se la come.
const SALIDA_PATH = "/salir";
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
 * del JWT SIN verificar la firma — acá sólo decide a dónde rebota el proxy
 * (puro UX de ruteo). La autorización real la hacen los guards del API, que sí
 * verifican. Corre en el edge runtime: `atob`, no `Buffer`.
 */
function leerPayload(token: string): { plat?: boolean; exp?: number } | null {
  try {
    const seg = token.split(".")[1];
    if (!seg) return null;
    let b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(b64)) as { plat?: boolean; exp?: number };
  } catch {
    return null;
  }
}

function esSesionPlataforma(token: string): boolean {
  return leerPayload(token)?.plat === true;
}

/**
 * ¿La cookie sirve para algo?
 *
 * Que exista NO alcanza. Con una cookie presente pero inservible —el token
 * venció, quedó de un logout que no la borró, o es basura— el proxy
 * rebotaba /login → "/" y el layout del dashboard rebotaba "/" → /login: bucle
 * infinito, y la persona no llegaba ni a la pantalla de login. La única salida
 * era borrar cookies a mano.
 *
 * Se mira el `exp` del JWT sin verificar la firma, igual que `esSesionPlataforma`:
 * esto es ruteo, la autorización de verdad la hacen los guards del API.
 */
function tokenUsable(token: string | undefined): token is string {
  if (!token) return false;
  const payload = leerPayload(token);
  if (!payload) return false;
  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
    return false;
  }
  return true;
}

export function proxy(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  // Una cookie que no sirve se trata como si no estuviera Y se borra: dejarla
  // puesta es lo que arma el bucle en el request siguiente.
  const token = tokenUsable(cookie) ? cookie : undefined;
  const cookieInservible = Boolean(cookie) && !token;
  const { pathname } = request.nextUrl;
  const isAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));
  const isOpenPath = OPEN_PATH_RE.test(pathname);
  const esBackoffice =
    pathname === "/backoffice" || pathname.startsWith("/backoffice/");

  if (isOpenPath || pathname === SALIDA_PATH) {
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
    return limpiando(
      NextResponse.redirect(new URL("/login", request.url)),
      cookieInservible,
    );
  }

  if (token && isAuthPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return limpiando(NextResponse.next(), cookieInservible);
}

/** Borra la cookie muerta en la respuesta que ya se iba a devolver. */
function limpiando(response: NextResponse, hayQueBorrar: boolean) {
  if (hayQueBorrar) response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand|api).*)"],
};
