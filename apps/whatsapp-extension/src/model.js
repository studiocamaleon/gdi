export function grafoOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Ingresá una URL completa, por ejemplo https://tu-grafo.com.",
    );
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error(
      "Usá sólo la dirección principal de Grafo, sin rutas ni credenciales.",
    );
  }
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  ) {
    throw new Error(
      "La conexión debe usar HTTPS. HTTP sólo está disponible para localhost.",
    );
  }
  if (url.hostname === "web.whatsapp.com")
    throw new Error("Ingresá la dirección de Grafo, no la de WhatsApp.");
  return url.origin;
}
export function permissionPattern(origin) {
  const url = new URL(grafoOrigin(origin));
  return `${url.protocol}//${url.hostname}/*`;
}
export function phoneInput(value) {
  const text = value.trim();
  if (
    !/^\+[\d\s().-]+$/.test(text) ||
    !/^[1-9]\d{7,14}$/.test(text.replace(/\D/g, ""))
  ) {
    throw new Error(
      "Ingresá el número completo con + y código de país. Ejemplo: +54 9 2966 123456.",
    );
  }
  return `+${text.replace(/\D/g, "")}`;
}
export function deliveryDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "Sin fecha acordada";
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
export const statuses = {
  borrador: "Borrador",
  pendiente: "Pendiente",
  produccion: "En producción",
  finalizada: "Finalizada",
  entregada: "Entregada",
  cancelada: "Cancelada",
};
// Invalidar aborta el transporte y además descarta respuestas ya completadas
// o transportes que no respeten AbortSignal al cambiar de chat/conexión.
export class LatestRequest {
  #version = 0;
  #controller;
  invalidate() {
    this.#version += 1;
    this.#controller?.abort();
  }
  async run(request, commit, fail) {
    this.invalidate();
    const version = this.#version;
    this.#controller = new AbortController();
    try {
      const result = await request(this.#controller.signal);
      if (version === this.#version) commit(result);
    } catch (error) {
      if (version === this.#version && error.name !== "AbortError") fail(error);
    }
  }
}
