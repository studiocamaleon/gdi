import { ArchivoScope } from '@prisma/client';

/**
 * Allowlist de tipos. Se cruza extensión contra MIME: un `.pdf` que dice ser
 * `text/html` no entra, y un `.html` renombrado a `.pdf` tampoco va a poder
 * ejecutarse porque además se sirve con `attachment` (ver `esInline`).
 *
 * Muchos formatos de imprenta (ai, eps, cdr, plt) llegan del navegador como
 * `application/octet-stream` porque el SO no los conoce: por eso el genérico
 * se acepta siempre. La defensa real contra el contenido no es el MIME
 * declarado — es el Content-Disposition firmado.
 */
type TipoPermitido = {
  mimes: string[];
  /** Se puede mostrar embebido sin riesgo de ejecutar script en nuestro dominio. */
  inline: boolean;
};

const GENERICO = 'application/octet-stream';

const TIPOS: Record<string, TipoPermitido> = {
  // Documentos e imágenes seguros de mostrar embebidos.
  pdf: { mimes: ['application/pdf'], inline: true },
  png: { mimes: ['image/png'], inline: true },
  jpg: { mimes: ['image/jpeg'], inline: true },
  jpeg: { mimes: ['image/jpeg'], inline: true },
  webp: { mimes: ['image/webp'], inline: true },
  gif: { mimes: ['image/gif'], inline: true },

  // SVG es una imagen que puede traer <script>: se acepta subirla (es un
  // formato de arte legítimo) pero NUNCA se sirve inline.
  svg: { mimes: ['image/svg+xml'], inline: false },

  // Formatos de producción gráfica.
  ai: {
    mimes: ['application/postscript', 'application/illustrator'],
    inline: false,
  },
  eps: { mimes: ['application/postscript', 'image/x-eps'], inline: false },
  psd: { mimes: ['image/vnd.adobe.photoshop'], inline: false },
  tif: { mimes: ['image/tiff'], inline: false },
  tiff: { mimes: ['image/tiff'], inline: false },
  cdr: { mimes: ['application/x-coreldraw'], inline: false },
  dxf: { mimes: ['image/vnd.dxf', 'application/dxf'], inline: false },
  plt: { mimes: [], inline: false },
  indd: { mimes: [], inline: false },

  // Adjuntos administrativos (órdenes de compra, listados del cliente).
  doc: { mimes: ['application/msword'], inline: false },
  docx: {
    mimes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    inline: false,
  },
  xls: { mimes: ['application/vnd.ms-excel'], inline: false },
  xlsx: {
    mimes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    inline: false,
  },
  csv: { mimes: ['text/csv'], inline: false },
  zip: {
    mimes: ['application/zip', 'application/x-zip-compressed'],
    inline: false,
  },
  rar: {
    mimes: ['application/vnd.rar', 'application/x-rar-compressed'],
    inline: false,
  },
};

/** Sólo estos tipos valen como logo del tenant (se embebe en los PDF). */
const EXTENSIONES_LOGO = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg']);

export function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf('.');
  if (punto <= 0 || punto === nombre.length - 1) return '';
  return nombre.slice(punto + 1).toLowerCase();
}

export function esExtensionPermitida(ext: string): boolean {
  return Object.hasOwn(TIPOS, ext);
}

/** ¿El MIME declarado es coherente con la extensión? */
export function mimeCoherente(ext: string, mime: string): boolean {
  const tipo = TIPOS[ext];
  if (!tipo) return false;
  const limpio = mime.split(';')[0].trim().toLowerCase();
  return limpio === GENERICO || limpio === '' || tipo.mimes.includes(limpio);
}

export function esInline(ext: string): boolean {
  return TIPOS[ext]?.inline ?? false;
}

export function esExtensionDeLogo(ext: string): boolean {
  return EXTENSIONES_LOGO.has(ext);
}

export function extensionesPermitidas(): string[] {
  return Object.keys(TIPOS).sort();
}

/**
 * Content-Disposition listo para firmar. El nombre va dos veces: la versión
 * ASCII para clientes viejos y `filename*` en UTF-8 para los acentos y la ñ
 * (RFC 5987). Se sanea a mano porque este string termina dentro de una
 * cabecera HTTP: un `"` o un salto de línea sin escapar es inyección de
 * cabecera.
 */
export function dispositionDe(nombreOriginal: string, ext: string): string {
  const modo = esInline(ext) ? 'inline' : 'attachment';
  const limpio = nombreOriginal.replace(/[\r\n"\\]/g, '_').slice(0, 200);
  const ascii = limpio.replace(/[^\x20-\x7E]/g, '_');
  return `${modo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(limpio)}`;
}

/**
 * `t/{tenantId}/{scope}/{entidadId}/{archivoId}.{ext}`
 *
 * El tenant va primero para poder medir uso, aplicar reglas de lifecycle por
 * prefijo y, si algún día hace falta, migrar a bucket-por-tenant o a tokens
 * de R2 con scope de prefijo sin rehacer las claves.
 *
 * El nombre original NUNCA entra acá: path traversal, unicode, colisiones y
 * fuga de información en los logs. Vive en `Archivo.nombreOriginal`.
 */
export function construirKey(params: {
  tenantId: string;
  scope: ArchivoScope;
  entidadId: string | null;
  archivoId: string;
  ext: string;
}): string {
  const carpeta = params.scope.toLowerCase().replace(/_/g, '-');
  const entidad = params.entidadId ?? '_';
  const sufijo = params.ext ? `.${params.ext}` : '';
  return `t/${params.tenantId}/${carpeta}/${entidad}/${params.archivoId}${sufijo}`;
}
