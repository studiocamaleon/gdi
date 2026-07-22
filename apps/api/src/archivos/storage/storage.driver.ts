/**
 * Contrato del almacenamiento de objetos. Dos implementaciones:
 *
 *  - `R2Driver`    — Cloudflare R2 vía S3 API (producción).
 *  - `LocalDriver` — disco, para desarrollar y testear sin credenciales.
 *
 * Las dos hablan el mismo idioma de URLs firmadas con vencimiento, así que el
 * front usa exactamente el mismo camino en dev y en prod: pide, sube directo,
 * confirma. Si el driver local expusiera un endpoint "fácil" (subir por el
 * API), dev y prod divergirían justo en la parte que más importa probar.
 *
 * Ver docs/archivos-r2-diseno.md
 */

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

export type UrlFirmada = {
  url: string;
  /** Headers que el cliente DEBE mandar para que la firma valide. */
  headers: Record<string, string>;
  /** Segundos de vida de la firma. */
  expiraEn: number;
};

export type ObjetoMeta = {
  bytes: number;
  contentType: string | null;
};

/**
 * Subida en partes, para archivos que no entran en un solo PUT. Cada parte se
 * sube con su propia URL firmada y devuelve un ETag; el `completar` los junta.
 *
 * S3/R2 exigen partes de al menos 5 MB (salvo la última) y como máximo 10.000
 * partes, lo que fija el techo real del sistema.
 */
export type MultipartIniciado = {
  uploadId: string;
  partes: Array<{ numero: number; url: string }>;
  tamanioParte: number;
};

export type ParteSubida = { numero: number; etag: string };

export interface StorageDriver {
  readonly nombre: 'r2' | 'local';

  /** URL de subida directa. El byte no pasa por el API. */
  firmarSubida(
    key: string,
    opciones: { contentType: string; expiraSegundos?: number },
  ): Promise<UrlFirmada>;

  /**
   * URL de descarga de vida corta. `disposition` va FIRMADO: el cliente no lo
   * puede alterar, que es lo que evita que un .svg se sirva inline desde
   * nuestro dominio (XSS).
   */
  firmarDescarga(
    key: string,
    opciones: {
      disposition: string;
      contentType?: string;
      expiraSegundos?: number;
    },
  ): Promise<string>;

  /**
   * Subida desde el servidor, sin presign. Es para lo que GENERA el sistema
   * (el PDF de un presupuesto, el de un comprobante): no hay un navegador
   * del otro lado que pueda hacer el PUT, y los bytes ya están en memoria.
   * Las subidas de usuarios siguen yendo por `firmarSubida`.
   */
  subir(key: string, contenido: Buffer, contentType: string): Promise<void>;

  /**
   * Abre una subida en partes y firma una URL por parte. El navegador las
   * sube en paralelo y guarda los ETags que devuelve cada PUT.
   *
   * OJO EN R2: el bucket tiene que exponer el header `ETag` por CORS
   * (`ExposeHeaders`), o el navegador no puede leerlo y el completar falla
   * sin síntoma claro.
   */
  iniciarMultipart(
    key: string,
    opciones: { contentType: string; bytes: number },
  ): Promise<MultipartIniciado>;

  /** Cierra la subida en partes y deja el objeto final armado. */
  completarMultipart(
    key: string,
    uploadId: string,
    partes: ParteSubida[],
  ): Promise<void>;

  /** Descarta una subida en partes a medias (libera lo ya subido). */
  abortarMultipart(key: string, uploadId: string): Promise<void>;

  /** Metadata REAL del objeto. Null si no existe. Es la fuente de verdad. */
  cabecera(key: string): Promise<ObjetoMeta | null>;

  /** Idempotente: borrar algo que no está no es un error. */
  borrar(key: string): Promise<void>;

  /** Bytes crudos. Sólo para uso del servidor (embeber el logo en un PDF). */
  leer(key: string): Promise<Buffer | null>;

  /**
   * Los primeros N bytes del objeto, con un GET por rango. Es para verificar
   * la firma del formato al confirmar una subida: bajar un arte de 800 MB
   * entero para mirarle 64 bytes no es una opción.
   */
  leerCabecera(key: string, bytes: number): Promise<Buffer | null>;
}
