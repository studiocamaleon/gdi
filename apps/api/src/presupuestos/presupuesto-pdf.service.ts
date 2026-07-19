import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsPDF } from 'jspdf';

/**
 * PDF del presupuesto — port del rediseño DesignSync
 * "Presupuesto (rediseño).html" (vista 1 · PDF): banda oscura con la
 * identidad del tenant y el número, franja de meta en 4 columnas, items
 * como cards con chips de specs, totales con el TOTAL en caja oscura,
 * nota de condiciones destacada y pie con la firma Grafoprint.
 * jsPDF vectorial server-side, Geist incrustada (fallback Helvetica).
 */

const MARGEN = 14;
const ANCHO = 210;
const CONTENIDO = ANCHO - MARGEN * 2;

const INK: [number, number, number] = [20, 20, 26];
const INK2: [number, number, number] = [44, 44, 51];
const MUTED: [number, number, number] = [110, 110, 118];
const MUTED2: [number, number, number] = [146, 146, 155];
const HAIRLINE: [number, number, number] = [239, 236, 232];
const BORDER: [number, number, number] = [231, 229, 226];
const SURFACE2: [number, number, number] = [250, 250, 249];
const ACCENT: [number, number, number] = [217, 100, 42];
const ACCENT_BG: [number, number, number] = [253, 241, 234];
const ACCENT_BORD: [number, number, number] = [240, 205, 184];

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
export class PresupuestoPdfService {
  private readonly log = new Logger(PresupuestoPdfService.name);
  private familia = 'helvetica';

  generar(d: PresupuestoPdfDatos): Buffer {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.registrarFuente(pdf);
    pdf.setFont(this.familia, 'normal');

    let y = this.banda(pdf, d);
    y = this.meta(pdf, d, y);
    y = this.items(pdf, d, y);
    y = this.totales(pdf, d, y);
    this.pie(pdf, d, y);

    return Buffer.from(pdf.output('arraybuffer'));
  }

  private registrarFuente(pdf: jsPDF) {
    const geist = cargarGeist(this.log);
    if (!geist) {
      this.familia = 'helvetica';
      return;
    }
    pdf.addFileToVFS('Geist-Regular.ttf', geist.regular);
    pdf.addFont('Geist-Regular.ttf', 'Geist', 'normal');
    pdf.addFileToVFS('Geist-Bold.ttf', geist.bold);
    pdf.addFont('Geist-Bold.ttf', 'Geist', 'bold');
    this.familia = 'Geist';
  }

  /** Banda superior oscura: identidad del tenant + número + validez. */
  private banda(pdf: jsPDF, d: PresupuestoPdfDatos): number {
    const alto = 34;
    pdf.setFillColor(...INK);
    pdf.rect(0, 0, ANCHO, alto, 'F');

    // Logo del tenant: cuadrado claro con iniciales.
    pdf.setFillColor(224, 224, 220);
    pdf.roundedRect(MARGEN, 9, 14, 14, 3, 3, 'F');
    pdf.setTextColor(...INK);
    pdf.setFont(this.familia, 'bold');
    pdf.setFontSize(11);
    pdf.text(inicialesDe(d.negocio), MARGEN + 7, 16 + 2.5, { align: 'center' });

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(15);
    pdf.text(d.negocio, MARGEN + 18.5, 16);
    pdf.setFont(this.familia, 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(200, 200, 205);
    pdf.text('Presupuesto comercial', MARGEN + 18.5, 21.2);

    // Derecha: label + número + pill de validez.
    pdf.setFontSize(7.5);
    pdf.setTextColor(180, 180, 188);
    pdf.text('P R E S U P U E S T O', ANCHO - MARGEN, 12, { align: 'right' });
    pdf.setFont(this.familia, 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(255, 255, 255);
    pdf.text(d.numero, ANCHO - MARGEN, 18.5, { align: 'right' });
    if (d.fechaValidez) {
      const texto = `Válido hasta ${fechaCorta(d.fechaValidez)}`;
      pdf.setFont(this.familia, 'normal');
      pdf.setFontSize(8);
      const w = pdf.getTextWidth(texto) + 8;
      pdf.setDrawColor(90, 90, 98);
      pdf.setFillColor(45, 45, 52);
      pdf.roundedRect(ANCHO - MARGEN - w, 22.2, w, 6.4, 3.2, 3.2, 'FD');
      pdf.setFillColor(126, 224, 175);
      pdf.circle(ANCHO - MARGEN - w + 3.4, 25.4, 0.9, 'F');
      pdf.setTextColor(235, 235, 238);
      pdf.text(texto, ANCHO - MARGEN - w + 6, 26.5);
    }
    return alto;
  }

  /** Franja de meta: Cliente · Fecha · Válido hasta · Vendedor. */
  private meta(pdf: jsPDF, d: PresupuestoPdfDatos, y: number): number {
    const columnas: Array<[string, string]> = [
      ['CLIENTE', d.cliente ?? '—'],
      ['FECHA', fechaCorta(d.fechaEmision)],
      ['VÁLIDO HASTA', fechaCorta(d.fechaValidez)],
      ['VENDEDOR', d.vendedor ?? '—'],
    ];
    const alto = 16;
    const anchoCol = CONTENIDO / columnas.length;
    columnas.forEach(([k, v], i) => {
      const x = MARGEN + i * anchoCol;
      pdf.setFont(this.familia, 'bold');
      pdf.setFontSize(6.8);
      pdf.setTextColor(...MUTED2);
      pdf.text(k, x, y + 6.5);
      pdf.setFont(this.familia, 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...INK);
      pdf.text(pdf.splitTextToSize(v, anchoCol - 6)[0] ?? v, x, y + 12);
      if (i > 0) {
        pdf.setDrawColor(...HAIRLINE);
        pdf.setLineWidth(0.3);
        pdf.line(x - 3, y + 3, x - 3, y + alto - 2);
      }
    });
    pdf.setDrawColor(...HAIRLINE);
    pdf.line(MARGEN, y + alto, ANCHO - MARGEN, y + alto);
    return y + alto + 8;
  }

  /** Items como cards con índice, precio y chips de specs. */
  private items(pdf: jsPDF, d: PresupuestoPdfDatos, y: number): number {
    pdf.setFont(this.familia, 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text('D E T A L L E', MARGEN, y);
    y += 4;

    for (const [idx, item] of d.items.entries()) {
      const chips = [
        ...item.specs.map((s) => `${s.etiqueta}: ${s.valor}`),
        ...item.adicionales,
      ];
      const filasChips = this.medirFilasChips(pdf, chips, CONTENIDO - 24);
      const altoCard = 16 + (chips.length ? filasChips * 7 + 2 : 0);
      if (y + altoCard > 270) {
        pdf.addPage();
        y = MARGEN;
      }

      pdf.setDrawColor(...BORDER);
      pdf.setLineWidth(0.35);
      pdf.roundedRect(MARGEN, y, CONTENIDO, altoCard, 3.5, 3.5, 'S');

      // Índice con el acento del diseño.
      pdf.setFillColor(...ACCENT_BG);
      pdf.setDrawColor(...ACCENT_BORD);
      pdf.roundedRect(MARGEN + 5, y + 4.5, 8, 8, 2, 2, 'FD');
      pdf.setFont(this.familia, 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...ACCENT);
      pdf.text(String(idx + 1), MARGEN + 9, y + 9.9, { align: 'center' });

      pdf.setFontSize(11.5);
      pdf.setTextColor(...INK);
      pdf.text(item.nombre, MARGEN + 17, y + 8);
      pdf.setFont(this.familia, 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...MUTED);
      const unitario = item.cantidad > 0 ? item.total / item.cantidad : 0;
      pdf.text(
        `${item.cantidad.toLocaleString('es-AR')} ${item.cantidadUnidad} · ${money(unitario)} c/u`,
        MARGEN + 17,
        y + 12.8,
      );
      pdf.setFont(this.familia, 'bold');
      pdf.setFontSize(11.5);
      pdf.setTextColor(...INK);
      pdf.text(money(item.total), ANCHO - MARGEN - 5, y + 8, { align: 'right' });

      if (chips.length) {
        this.dibujarChips(pdf, chips, MARGEN + 17, y + 16.5, CONTENIDO - 24);
      }
      y += altoCard + 4;
    }
    return y + 2;
  }

  private medirFilasChips(pdf: jsPDF, chips: string[], anchoMax: number): number {
    pdf.setFont(this.familia, 'normal');
    pdf.setFontSize(7.5);
    let filas = 1;
    let x = 0;
    for (const chip of chips) {
      const w = pdf.getTextWidth(chip) + 7;
      if (x + w > anchoMax) {
        filas += 1;
        x = 0;
      }
      x += w + 2;
    }
    return filas;
  }

  private dibujarChips(pdf: jsPDF, chips: string[], x0: number, y0: number, anchoMax: number) {
    pdf.setFont(this.familia, 'normal');
    pdf.setFontSize(7.5);
    let x = x0;
    let y = y0;
    for (const chip of chips) {
      const w = pdf.getTextWidth(chip) + 7;
      if (x + w > x0 + anchoMax) {
        x = x0;
        y += 7;
      }
      pdf.setFillColor(...SURFACE2);
      pdf.setDrawColor(...BORDER);
      pdf.roundedRect(x, y, w, 5.6, 2.8, 2.8, 'FD');
      pdf.setTextColor(...INK2);
      pdf.text(chip, x + 3.5, y + 3.9);
      x += w + 2;
    }
  }

  /** Totales a la derecha; el TOTAL va en caja oscura (diseño). */
  private totales(pdf: jsPDF, d: PresupuestoPdfDatos, y: number): number {
    const anchoBox = 82;
    const x0 = ANCHO - MARGEN - anchoBox;
    const filas: Array<[string, string]> = [
      ['Subtotal', money(d.subtotal)],
      ...(d.cargosDirectos > 0
        ? ([['Cargos', money(d.cargosDirectos)]] as Array<[string, string]>)
        : []),
      ['Impuestos', money(d.impuestos)],
    ];
    if (y + filas.length * 6 + 20 > 275) {
      pdf.addPage();
      y = MARGEN;
    }
    for (const [k, v] of filas) {
      pdf.setFont(this.familia, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...MUTED);
      pdf.text(k, x0, y + 4.5);
      pdf.setTextColor(...INK2);
      pdf.text(v, ANCHO - MARGEN, y + 4.5, { align: 'right' });
      y += 6;
    }
    pdf.setFillColor(...INK);
    pdf.roundedRect(x0 - 2, y + 1, anchoBox + 2, 12.5, 2.5, 2.5, 'F');
    pdf.setFont(this.familia, 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(200, 200, 206);
    pdf.text('TOTAL', x0 + 3, y + 8.7);
    pdf.setFont(this.familia, 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text(money(d.total), ANCHO - MARGEN - 3, y + 9.3, { align: 'right' });
    return y + 20;
  }

  /** Nota de condiciones destacada + observaciones + firma. */
  private pie(pdf: jsPDF, d: PresupuestoPdfDatos, y: number) {
    const condiciones: string[] = [];
    if (d.senaSugeridaPct != null && d.senaSugeridaPct > 0) {
      condiciones.push(
        `Condiciones de pago: seña del ${d.senaSugeridaPct.toLocaleString('es-AR')}% para iniciar el trabajo, saldo contra entrega.`,
      );
    }
    if (d.fechaValidez) {
      condiciones.push(
        `Este presupuesto es válido hasta el ${fechaCorta(d.fechaValidez)}; pasada esa fecha los precios pueden actualizarse.`,
      );
    }
    if (condiciones.length) {
      const texto = condiciones.join(' ');
      const lineas = pdf.splitTextToSize(texto, CONTENIDO - 14) as string[];
      const alto = lineas.length * 4.4 + 7;
      if (y + alto > 275) {
        pdf.addPage();
        y = MARGEN;
      }
      pdf.setFillColor(...ACCENT_BG);
      pdf.setDrawColor(...ACCENT_BORD);
      pdf.roundedRect(MARGEN, y, CONTENIDO, alto, 3, 3, 'FD');
      pdf.setFont(this.familia, 'normal');
      pdf.setFontSize(8.8);
      pdf.setTextColor(...INK2);
      pdf.text(lineas, MARGEN + 7, y + 5.5);
      y += alto + 5;
    }

    const extras = [d.observaciones, d.condicionesTexto].filter(
      (t): t is string => !!t,
    );
    for (const bloque of extras) {
      const lineas = pdf.splitTextToSize(bloque, CONTENIDO) as string[];
      for (const linea of lineas) {
        if (y > 278) {
          pdf.addPage();
          y = MARGEN;
        }
        pdf.setFontSize(8);
        pdf.setTextColor(...MUTED);
        pdf.text(linea, MARGEN, y + 3.5);
        y += 4;
      }
      y += 2;
    }

    // Firma al pie de la página actual.
    const yFirma = Math.max(y + 6, 283);
    if (yFirma > 290) return;
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.3);
    pdf.line(MARGEN, yFirma - 4, ANCHO - MARGEN, yFirma - 4);
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED2);
    pdf.text(`Gracias por confiar en ${d.negocio}.`, MARGEN, yFirma);
    pdf.text('Generado con Grafoprint', ANCHO - MARGEN, yFirma, { align: 'right' });
  }
}
