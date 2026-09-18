export type ImpresoraPuesto = { host: string; impresora: string };
export const IMPRESORA_INICIAL: ImpresoraPuesto = {
  host: "localhost",
  impresora: "",
};
export function hostQzValido(host: string) {
  return (
    host.length <= 253 &&
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?))*$/i.test(
      host,
    )
  );
}
const clave = (tenantId: string) => `grafo:impresora-etiquetas:v1:${tenantId}`;
export function leerImpresora(tenantId: string): ImpresoraPuesto {
  try {
    const dato = JSON.parse(localStorage.getItem(clave(tenantId)) ?? "null");
    if (
      dato &&
      hostQzValido(dato.host) &&
      typeof dato.impresora === "string" &&
      dato.impresora.length <= 200
    )
      return { host: dato.host, impresora: dato.impresora };
  } catch {
    /* Configuración ausente o almacenamiento restringido. */
  }
  return { ...IMPRESORA_INICIAL };
}
export function guardarImpresora(tenantId: string, config: ImpresoraPuesto) {
  if (!hostQzValido(config.host) || !config.impresora.trim())
    throw new Error("Completá el equipo y la impresora.");
  try {
    localStorage.setItem(clave(tenantId), JSON.stringify(config));
  } catch {
    throw new Error(
      "El navegador no permitió guardar la impresora. Habilitá el almacenamiento para este sitio.",
    );
  }
}
