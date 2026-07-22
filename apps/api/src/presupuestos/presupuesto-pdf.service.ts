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

const money = (n: number) =>
  '$' +
  n.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fechaCorta = (iso: string | null) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const inicialesDe = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

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

@Injectable()
export class PresupuestoPdfService implements OnModuleDestroy {
  private readonly log = new Logger(PresupuestoPdfService.name);
  /** Chrome se reusa entre requests: levantarlo por PDF cuesta ~1s. */
  private navegador: Promise<Browser> | null = null;

  private browser(): Promise<Browser> {
    if (!this.navegador) {
      this.navegador = puppeteer
        .launch({
          headless: true,
          // --no-sandbox es necesario en contenedores sin user namespaces.
          args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
        })
        .catch((e) => {
          // Si falla el launch no dejamos la promesa rota cacheada.
          this.navegador = null;
          throw e;
        });
    }
    return this.navegador;
  }

  async onModuleDestroy() {
    const b = await this.navegador?.catch(() => null);
    await b?.close().catch(() => undefined);
  }

  /**
   * Renderiza el diseño con el motor de Chrome: el CSS del port se aplica tal
   * cual (flex, grid, radios, sombras) y `@page {size:A4;margin:0}` define el
   * pliego. Es la única forma de que el PDF salga idéntico al diseño.
   */
  async generar(d: PresupuestoPdfDatos): Promise<Buffer> {
    const html = construirHtmlPresupuesto(d, cargarGeist(this.log));
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
  }
}
