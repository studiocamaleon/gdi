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

  /** Metadata REAL del objeto. Null si no existe. Es la fuente de verdad. */
  cabecera(key: string): Promise<ObjetoMeta | null>;

  /** Idempotente: borrar algo que no está no es un error. */
  borrar(key: string): Promise<void>;

  /** Bytes crudos. Sólo para uso del servidor (embeber el logo en un PDF). */
  leer(key: string): Promise<Buffer | null>;
}
