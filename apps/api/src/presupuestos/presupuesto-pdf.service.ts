import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer, { type Browser } from 'puppeteer';

import { construirHtmlPresupuesto } from './presupuesto-pdf-html';

/**
 * PDF del presupuesto — se renderiza el diseño canónico
 * (claude.ai/design · "PDF Presupuesto.html") con Chrome headless.
 *
 * Antes se dibujaba a mano con jsPDF, que no tiene motor de layout: cada
 * cambio del diseño había que traducirlo a coordenadas y el resultado
 * siempre difería. Con `page.pdf()` corre el CSS real del diseño, así que
 * el PDF sale idéntico. El HTML vive en `presupuesto-pdf-html.ts`.
 */

let geistCache: { regular: string; bold: string } | null | undefined;

function cargarGeist(log: Logger): { regular: string; bold: string } | null {
  if (geistCache !== undefined) return geistCache;
  try {
    // Reusa los TTF del módulo de facturación (nest-cli los copia a dist).
    const dir = join(__dirname, '..', 'administracion', 'invoicing', 'fonts');
    geistCache = {
      regular: readFileSync(join(dir, 'Geist-Regular.ttf')).toString('base64'),
      bold: readFileSync(join(dir, 'Geist-Bold.ttf')).toString('base64'),
    };
  } catch (e) {
    log.warn(
      `No pude cargar Geist para el PDF del presupuesto (${e instanceof Error ? e.message : e}). Sale en Helvetica.`,
    );
    geistCache = null;
  }
  return geistCache;
}

// (Acá vivían `money`, `fechaCorta` e `inicialesDe`: sobras de cuando el PDF
// se dibujaba a mano con jsPDF. El formateo ahora lo hace el HTML del port.)

export type PresupuestoPdfDatos = {
  numero: string;
  negocio: string;
  /**
   * Logo del tenant embebido como data URI. Null = se dibuja el cuadrado con
   * las iniciales (el fallback original del diseño). Va embebido y no como
   * URL porque el render corre con `waitUntil: 'domcontentloaded'` y no
   * espera recursos remotos: una `<img src="https://…">` saldría vacía.
   */
  logoDataUri?: string | null;
  cliente: string | null;
  vendedor: string | null;
  fechaEmision: string | null;
  fechaValidez: string | null;
  observaciones: string | null;
  senaSugeridaPct: number | null;
  condicionesTexto: string | null;
  subtotal: number;
  impuestos: number;
  cargosDirectos: number;
  total: number;
  items: Array<{
    nombre: string;
    cantidad: number;
    cantidadUnidad: string;
    total: number;
    specs: Array<{ etiqueta: string; valor: string }>;
    adicionales: string[];
  }>;
};

/**
 * Cuánto sobrevive Chrome sin que nadie le pida un PDF. Desde que los PDF se
 * guardan (F3), los renders vienen de a ráfagas —se emiten tres presupuestos
 * seguidos y después no pasa nada por horas—, así que mantener ~150 MB de
 * navegador residente el resto del día no tiene sentido. Cinco minutos cubren
 * la ráfaga sin pagar el relanzamiento (~1 s) dentro de ella.
 */
const MINUTOS_OCIOSO = Number(process.env.PDF_CHROME_IDLE_MIN ?? 5);

@Injectable()
export class PresupuestoPdfService implements OnModuleDestroy {
  private readonly log = new Logger(PresupuestoPdfService.name);
  /** Chrome se reusa entre requests: levantarlo por PDF cuesta ~1s. */
  private navegador: Promise<Browser> | null = null;
  private apagado: NodeJS.Timeout | null = null;
  /** Renders en vuelo: no se cierra el navegador con una página abierta. */
  private enUso = 0;

  private browser(): Promise<Browser> {
    if (!this.navegador) {
      this.navegador = puppeteer
        .launch({
          headless: true,
          // --no-sandbox es necesario en contenedores sin user namespaces.
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--font-render-hinting=none',
          ],
        })
        .catch((e) => {
          // Si falla el launch no dejamos la promesa rota cacheada.
          this.navegador = null;
          throw e;
        });
    }
    return this.navegador;
  }

  /** Reprograma el apagado; si hay un render en curso, no arma nada. */
  private programarApagado() {
    if (this.apagado) clearTimeout(this.apagado);
    this.apagado = null;
    if (this.enUso > 0 || !this.navegador) return;
    this.apagado = setTimeout(() => {
      void this.cerrar('inactividad');
    }, MINUTOS_OCIOSO * 60_000);
    // Un navegador ocioso no puede ser la razón por la que el proceso no
    // termina: sin unref, este timer mantiene vivo el event loop.
    this.apagado.unref();
  }

  private async cerrar(motivo: string) {
    const pendiente = this.navegador;
    if (!pendiente || this.enUso > 0) return;
    this.navegador = null;
    const b = await pendiente.catch(() => null);
    await b?.close().catch(() => undefined);
    this.log.debug(`Chrome cerrado por ${motivo}.`);
  }

  async onModuleDestroy() {
    if (this.apagado) clearTimeout(this.apagado);
    const b = await this.navegador?.catch(() => null);
    this.navegador = null;
    await b?.close().catch(() => undefined);
  }

  /**
   * Renderiza el diseño con el motor de Chrome: el CSS del port se aplica tal
   * cual (flex, grid, radios, sombras) y `@page {size:A4;margin:0}` define el
   * pliego. Es la única forma de que el PDF salga idéntico al diseño.
   */
  async generar(d: PresupuestoPdfDatos): Promise<Buffer> {
    const html = construirHtmlPresupuesto(d, cargarGeist(this.log));
    // El contador sube ANTES del await: si dos requests entran juntas, la
    // segunda no puede encontrarse con el navegador cerrado por el timer.
    this.enUso += 1;
    if (this.apagado) {
      clearTimeout(this.apagado);
      this.apagado = null;
    }
    try {
      const navegador = await this.browser();
      const page = await navegador.newPage();
      try {
        // `domcontentloaded` alcanza: no hay recursos remotos (fuentes embebidas).
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        await page.evaluateHandle('document.fonts.ready');
        const pdf = await page.pdf({
          format: 'a4',
          printBackground: true,
          preferCSSPageSize: true,
        });
        return Buffer.from(pdf);
      } finally {
        await page.close().catch(() => undefined);
      }
    } finally {
      this.enUso -= 1;
      this.programarApagado();
    }
  }
}
