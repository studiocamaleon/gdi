/**
 * Archivos de los tenants (Cloudflare R2 en producción, disco en dev).
 * Ver docs/archivos-r2-diseno.md
 */

export const ARCHIVO_SCOPES = [
  "TENANT_BRANDING",
  "CLIENTE",
  "ORDEN",
  "ORDEN_ITEM",
  "COTIZACION",
  "COMPROBANTE",
  "COBRO",
  "PRODUCTO",
  "PROVEEDOR",
] as const;

export type ArchivoScope = (typeof ARCHIVO_SCOPES)[number];

export type Archivo = {
  id: string;
  scope: ArchivoScope;
  nombre: string;
  mimeType: string;
  bytes: number;
  publico: boolean;
  descripcion: string | null;
  esImagen: boolean;
  createdAt: string;
  subidoPor: string | null;
};

/** Espejo de la allowlist del backend (tipos-archivo.ts). */
export const EXTENSIONES_PERMITIDAS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
  "ai",
  "eps",
  "psd",
  "tif",
  "tiff",
  "cdr",
  "dxf",
  "plt",
  "indd",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "zip",
  "rar",
] as const;

export const EXTENSIONES_LOGO = ["png", "jpg", "jpeg", "webp", "svg"] as const;

export const MAX_BYTES = 100 * 1024 * 1024;

export function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf(".");
  if (punto <= 0 || punto === nombre.length - 1) return "";
  return nombre.slice(punto + 1).toLowerCase();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * URL para mostrar o descargar. Va por el proxy BFF porque la sesión vive en
 * una cookie httpOnly que JS no puede leer: el proxy adjunta el token y
 * reenvía el 302 a la URL firmada del storage, que el navegador sigue solo.
 * Sirve tal cual como `src` de un <img>.
 */
export function urlDeArchivo(id: string): string {
  return `/api/backend/archivos/${id}/contenido`;
}

/** Mensaje de rechazo, o null si el archivo pasa. */
export function validarArchivo(
  file: File,
  opciones?: { extensiones?: readonly string[]; maxBytes?: number },
): string | null {
  const permitidas = opciones?.extensiones ?? EXTENSIONES_PERMITIDAS;
  const max = opciones?.maxBytes ?? MAX_BYTES;
  const ext = extensionDe(file.name);

  if (!ext) return "El archivo no tiene extensión.";
  if (!permitidas.includes(ext)) {
    return `.${ext} no está permitido. Aceptamos: ${permitidas.join(", ")}.`;
  }
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > max) {
    return `Supera el máximo de ${formatBytes(max)}.`;
  }
  return null;
}
