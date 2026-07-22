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

// ── Verificación por contenido (magic bytes) ─────────────────────────────

/**
 * Firmas del comienzo del archivo. Es la única validación que NO depende de
 * lo que dijo el cliente: la extensión la elige quien sube y el `Content-Type`
 * también, así que un `.exe` renombrado a `.pdf` pasa las dos.
 *
 * Cada entrada devuelve si el buffer corresponde a ese formato. Las que
 * devuelven `null` son formatos que no tienen firma —texto plano, sobre todo—
 * y no se pueden verificar así; para esos la defensa sigue siendo el
 * `Content-Disposition: attachment`.
 */
type Verificador = (b: Buffer) => boolean;

const empiezaCon = (...bytes: number[]): Verificador => {
  return (b) => b.length >= bytes.length && bytes.every((v, i) => b[i] === v);
};

const alguno =
  (...vs: Verificador[]): Verificador =>
  (b) =>
    vs.some((v) => v(b));

/** RIFF con un tipo específico en los bytes 8..11 (WEBP, CDR). */
const riff = (tipo: string): Verificador => {
  const t = Buffer.from(tipo, 'ascii');
  return (b) =>
    b.length >= 12 &&
    b.subarray(0, 4).toString('ascii') === 'RIFF' &&
    b.subarray(8, 12).equals(t);
};

const PDF = empiezaCon(0x25, 0x50, 0x44, 0x46); // %PDF
const ZIP = alguno(
  empiezaCon(0x50, 0x4b, 0x03, 0x04),
  empiezaCon(0x50, 0x4b, 0x05, 0x06), // vacío
  empiezaCon(0x50, 0x4b, 0x07, 0x08), // spanned
);
/** Formato OLE de Office viejo (.doc, .xls). */
const OLE = empiezaCon(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);

const FIRMAS: Record<string, Verificador> = {
  pdf: PDF,
  png: empiezaCon(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  jpg: empiezaCon(0xff, 0xd8, 0xff),
  jpeg: empiezaCon(0xff, 0xd8, 0xff),
  gif: alguno(
    empiezaCon(0x47, 0x49, 0x46, 0x38, 0x37, 0x61), // GIF87a
    empiezaCon(0x47, 0x49, 0x46, 0x38, 0x39, 0x61), // GIF89a
  ),
  webp: riff('WEBP'),
  cdr: riff('CDRA'),
  psd: empiezaCon(0x38, 0x42, 0x50, 0x53), // 8BPS
  tif: alguno(
    empiezaCon(0x49, 0x49, 0x2a, 0x00), // little endian
    empiezaCon(0x4d, 0x4d, 0x00, 0x2a), // big endian
  ),
  zip: ZIP,
  rar: alguno(
    empiezaCon(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00),
    empiezaCon(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00), // v5
  ),
  // Office moderno es un zip; el viejo es OLE. Se aceptan los dos.
  docx: ZIP,
  xlsx: ZIP,
  doc: OLE,
  xls: OLE,
  // Illustrator moderno ES un PDF; el viejo, PostScript. EPS suma su
  // cabecera binaria de DOS.
  ai: alguno(PDF, empiezaCon(0x25, 0x21, 0x50, 0x53)), // %!PS
  eps: alguno(
    empiezaCon(0x25, 0x21, 0x50, 0x53), // %!PS
    empiezaCon(0xc5, 0xd0, 0xd3, 0xc6), // EPS binario
    PDF,
  ),
};

FIRMAS.tiff = FIRMAS.tif;

/**
 * Cuántos bytes del principio alcanzan para decidir. 12 cubren la firma más
 * larga (RIFF, que mira los bytes 8..11); se leen 64 por margen.
 */
export const BYTES_DE_FIRMA = 64;

/**
 * ¿El contenido real corresponde a la extensión declarada?
 *
 * `null` = ese formato no tiene firma verificable (texto plano: csv, dxf, svg,
 * plt) y no se puede afirmar ni negar.
 */
export function contenidoCoincide(
  ext: string,
  cabecera: Buffer,
): boolean | null {
  const verificador = FIRMAS[ext];
  if (!verificador) return null;
  return verificador(cabecera);
}
