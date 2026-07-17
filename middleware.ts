import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session";

// Páginas de autenticación: accesibles sin sesión y, si ya hay sesión, se
// rebota al home (no tiene sentido re-loguearse).
const AUTH_PATHS = ["/login", "/aceptar-invitacion"];
// Contenido ABIERTO: accesible por cualquiera con o sin sesión (no rebota al
// usuario logueado). El seguimiento público de OT vive acá.
const OPEN_PATHS = ["/track"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const { pathname } = request.nextUrl;
  const isAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));
  const isOpenPath = OPEN_PATHS.some((path) => pathname.startsWith(path));

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
