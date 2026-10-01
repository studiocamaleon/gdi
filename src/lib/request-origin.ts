/** Protección del BFF que autentica con cookies. No se aplica a webhooks de la API. */
export function comprobarOrigenDeEscritura(request: Request): Response | null {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;
  const configurado = process.env.WEB_ORIGIN ?? process.env.STAGING_WEB_ORIGIN;
  let esperado: string;
  try {
    if (!configurado && process.env.NODE_ENV === "production") {
      throw new Error("Falta el origen público de la aplicación");
    }
    const url = new URL(configurado ?? request.url);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("Origen inválido");
    esperado = url.origin;
  } catch {
    return Response.json(
      { message: "El acceso de la aplicación todavía no está configurado." },
      { status: 503 },
    );
  }
  // Origin ausente/null no es evidencia de confianza. Un cliente propio que
  // use este BFF debe enviarlo; los clientes Bearer usan la API directamente.
  if (
    request.headers.get("origin") !== esperado ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return Response.json(
      { message: "Origen del pedido no autorizado." },
      { status: 403 },
    );
  }
  return null;
}
