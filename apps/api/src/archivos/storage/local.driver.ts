import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { calcularTamanioParte } from './multipart';
import type {
  MultipartIniciado,
  ObjetoMeta,
  ParteSubida,
  StorageDriver,
  UrlFirmada,
} from './storage.driver';

const SUBIDA_SEGUNDOS = 15 * 60;
const DESCARGA_SEGUNDOS = 60;
/** Tope del barrido de partes al abortar (es dev: no hace falta ser exacto). */
const MAX_PARTES_A_BARRER = 200;

/**
 * Driver de desarrollo: los objetos van a disco bajo `apps/api/.storage/`.
 *
 * Imita la semántica de R2 en lo que importa — URL con vencimiento, firma que
 * cubre el `Content-Disposition`, sin sesión — para que el front no tenga una
 * rama "modo dev". Las URLs apuntan a endpoints @Public del propio API que
 * validan el HMAC (ver ArchivosLocalController).
 *
 * No se usa en producción: el arranque falla si faltan las credenciales de R2
 * y NODE_ENV es production (ver storage.module.ts).
 */
@Injectable()
export class LocalDriver implements StorageDriver {
  readonly nombre = 'local' as const;
  private readonly logger = new Logger(LocalDriver.name);
  private readonly raiz = resolve(process.cwd(), '.storage');
  private readonly base =
    process.env.API_PUBLIC_URL ??
    `http://localhost:${process.env.PORT ?? 3001}`;
  private readonly secreto = process.env.JWT_SECRET ?? 'dev-storage';

  firmarSubida(
    key: string,
    opciones: { contentType: string; expiraSegundos?: number },
  ): Promise<UrlFirmada> {
    const expiraEn = opciones.expiraSegundos ?? SUBIDA_SEGUNDOS;
    const url = this.firmar('PUT', key, expiraEn, { ct: opciones.contentType });
    return Promise.resolve({
      url,
      headers: { 'Content-Type': opciones.contentType },
      expiraEn,
    });
  }

  firmarDescarga(
    key: string,
    opciones: {
      disposition: string;
      contentType?: string;
      expiraSegundos?: number;
    },
  ): Promise<string> {
    return Promise.resolve(
      this.firmar('GET', key, opciones.expiraSegundos ?? DESCARGA_SEGUNDOS, {
        cd: opciones.disposition,
        ct: opciones.contentType ?? 'application/octet-stream',
      }),
    );
  }

  subir(key: string, contenido: Buffer): Promise<void> {
    return this.escribir(key, contenido);
  }

  // ── Multipart (simulado: cada parte es un archivo suelto) ───────────

  iniciarMultipart(
    key: string,
    opciones: { contentType: string; bytes: number },
  ): Promise<MultipartIniciado> {
    // El uploadId es determinístico a partir de la clave: no hay servidor de
    // objetos que lleve estado, y la clave ya es única por archivo.
    const uploadId = createHash('sha1').update(key).digest('hex').slice(0, 16);
    const tamanioParte = calcularTamanioParte(opciones.bytes);
    const cantidad = Math.max(1, Math.ceil(opciones.bytes / tamanioParte));
    const partes = Array.from({ length: cantidad }, (_, i) => ({
      numero: i + 1,
      url: this.firmar('PUT', `${key}.parte${i + 1}`, SUBIDA_SEGUNDOS, {
        ct: opciones.contentType,
      }),
    }));
    return Promise.resolve({ uploadId, partes, tamanioParte });
  }

  async completarMultipart(
    key: string,
    _uploadId: string,
    partes: ParteSubida[],
  ): Promise<void> {
    const ordenadas = [...partes].sort((a, b) => a.numero - b.numero);
    const trozos: Buffer[] = [];
    for (const p of ordenadas) {
      const trozo = await this.leer(`${key}.parte${p.numero}`);
      if (!trozo) {
        throw new Error(`Falta la parte ${p.numero} de ${key}.`);
      }
      trozos.push(trozo);
    }
    await this.escribir(key, Buffer.concat(trozos));
    await this.borrarPartes(key, ordenadas.length);
  }

  async abortarMultipart(key: string): Promise<void> {
    // No se sabe cuántas partes llegaron: se barre hasta el primer hueco
    // largo. Es dev, no hace falta más precisión.
    await this.borrarPartes(key, MAX_PARTES_A_BARRER);
  }

  private async borrarPartes(key: string, hasta: number): Promise<void> {
    let faltantesSeguidas = 0;
    for (let i = 1; i <= hasta && faltantesSeguidas < 5; i += 1) {
      const ruta = this.rutaDe(`${key}.parte${i}`);
      try {
        await rm(ruta);
        faltantesSeguidas = 0;
      } catch {
        faltantesSeguidas += 1;
      }
    }
  }

  async cabecera(key: string): Promise<ObjetoMeta | null> {
    try {
      const s = await stat(this.rutaDe(key));
      // El disco no guarda el content-type; el confirmar cruza igual contra el
      // declarado y contra la extensión, así que devolvemos null y que decida.
      return { bytes: s.size, contentType: null };
    } catch {
      return null;
    }
  }

  async borrar(key: string): Promise<void> {
    await rm(this.rutaDe(key), { force: true });
  }

  async leerCabecera(key: string, bytes: number): Promise<Buffer | null> {
    const contenido = await this.leer(key);
    return contenido ? contenido.subarray(0, bytes) : null;
  }

  async leer(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.rutaDe(key));
    } catch {
      return null;
    }
  }

  // ── Usado por ArchivosLocalController (no es parte del contrato) ─────

  async escribir(key: string, contenido: Buffer): Promise<void> {
    const ruta = this.rutaDe(key);
    await mkdir(dirname(ruta), { recursive: true });
    await writeFile(ruta, contenido);
    this.logger.debug(`Guardado ${key} (${contenido.length} bytes) en disco.`);
  }

  /**
   * Valida la firma y el vencimiento. Devuelve los parámetros firmados para
   * que el controller los aplique tal cual — el cliente no puede cambiarlos.
   */
  verificar(
    metodo: 'PUT' | 'GET',
    key: string,
    query: Record<string, string | undefined>,
  ): { cd?: string; ct?: string } | null {
    const { exp, sig, cd, ct } = query;
    if (!exp || !sig) return null;
    if (Number(exp) * 1000 < Date.now()) return null;

    const esperada = this.hmac(metodo, key, Number(exp), { cd, ct });
    const a = Buffer.from(sig);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { cd, ct };
  }

  // ── Interno ─────────────────────────────────────────────────────────

  private firmar(
    metodo: 'PUT' | 'GET',
    key: string,
    expiraEn: number,
    extra: { cd?: string; ct?: string },
  ): string {
    const exp = Math.floor(Date.now() / 1000) + expiraEn;
    const sig = this.hmac(metodo, key, exp, extra);
    const qs = new URLSearchParams({ exp: String(exp), sig });
    if (extra.cd) qs.set('cd', extra.cd);
    if (extra.ct) qs.set('ct', extra.ct);
    return `${this.base}/api/archivos/local/${key}?${qs.toString()}`;
  }

  private hmac(
    metodo: string,
    key: string,
    exp: number,
    extra: { cd?: string; ct?: string },
  ): string {
    return createHmac('sha256', this.secreto)
      .update(`${metodo}\n${key}\n${exp}\n${extra.cd ?? ''}\n${extra.ct ?? ''}`)
      .digest('hex');
  }

  /**
   * Las claves las genera el servidor, pero igual se valida el traversal: es
   * la única barrera entre una clave mal construida y escribir fuera de
   * `.storage/`.
   */
  private rutaDe(key: string): string {
    const ruta = resolve(join(this.raiz, key));
    if (ruta !== this.raiz && !ruta.startsWith(this.raiz + sep)) {
      throw new Error(`Clave de storage fuera de rango: ${key}`);
    }
    return ruta;
  }
}
