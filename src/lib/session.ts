export const SESSION_COOKIE_NAME = "gdi_access_token";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function parseCookieValue(source: string, name: string) {
  const parts = source.split(";").map((part) => part.trim());
  const cookie = parts.find((part) => part.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(name.length + 1));
}

export async function getSessionToken() {
  if (typeof window === "undefined") {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  }

  return parseCookieValue(document.cookie, SESSION_COOKIE_NAME);
}

export function setSessionToken(token: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearSessionToken() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
