export const SESSION_COOKIE_NAME = "gdi_access_token";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export async function getSessionToken() {
  if (typeof window === "undefined") {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  }

  // En el navegador la cookie es httpOnly (no legible por JS). El token se
  // adjunta a las requests del lado servidor: en el proxy BFF (/api/backend)
  // para llamadas del cliente, o directo en apiRequest para server components.
  return null;
}

/**
 * Persiste el token de sesión como cookie httpOnly. Como httpOnly no puede
 * fijarse desde JS, delegamos en el route handler server-side /api/session.
 */
export async function setSessionToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error("No se pudo iniciar la sesión.");
  }
}

export async function clearSessionToken() {
  if (typeof window === "undefined") {
    return;
  }

  await fetch("/api/session", { method: "DELETE" });
}
