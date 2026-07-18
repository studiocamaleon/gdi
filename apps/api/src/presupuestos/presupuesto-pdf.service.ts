import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * PDF del presupuesto — mismo enfoque que el comprobante
 * (factura-pdf.service): jsPDF vectorial server-side, Geist incrustada con
 * fallback a Helvetica. El documento lleva lo que la industria considera
 * un presupuesto profesional: número, validez EXPLÍCITA, items, totales,
 * seña sugerida y condiciones del tenant.
 */

const MARGEN = 14;
const ANCHO = 210;
const CONTENIDO = ANCHO - MARGEN * 2;

const INK: [number, number, number] = [20, 20, 26];
const MUTED: [number, number, number] = [110, 110, 118];
const HAIRLINE: [number, number, number] = [239, 236, 232];

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

    let y = MARGEN;
    y = this.cabecera(pdf, d, y);
    y = this.itemsTabla(pdf, d, y);
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

  private cabecera(pdf: jsPDF, d: PresupuestoPdfDatos, y: number): number {
    pdf.setFont(this.familia, 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(...INK);
    pdf.text(d.negocio, MARGEN, y + 6);

    pdf.setFontSize(13);
    pdf.text('PRESUPUESTO', ANCHO - MARGEN, y + 4, { align: 'right' });
    pdf.setFont(this.familia, 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...MUTED);
    pdf.text(d.numero, ANCHO - MARGEN, y + 9.5, { align: 'right' });

    y += 16;
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.4);
    pdf.line(MARGEN, y, ANCHO - MARGEN, y);
    y += 6;

    pdf.setFontSize(9.5);
    const filas: Array<[string, string]> = [
      ['Cliente', d.cliente ?? '—'],
      ['Fecha', fechaCorta(d.fechaEmision)],
      ['Válido hasta', fechaCorta(d.fechaValidez)],
      ...(d.vendedor ? ([['Vendedor', d.vendedor]] as Array<[string, string]>) : []),
    ];
    for (const [k, v] of filas) {
      pdf.setTextColor(...MUTED);
      pdf.text(k, MARGEN, y);
      pdf.setTextColor(...INK);
      pdf.text(v, MARGEN + 26, y);
      y += 5;
    }
    return y + 2;
  }

  private itemsTabla(pdf: jsPDF, d: PresupuestoPdfDatos, y: number): number {
    const body = d.items.map((i) => {
      const detalle = [
        ...i.specs.map((s) => `${s.etiqueta}: ${s.valor}`),
        ...(i.adicionales.length ? [`Adicionales: ${i.adicionales.join(', ')}`] : []),
      ].join('  ·  ');
      return [
        `${i.nombre}${detalle ? `\n${detalle}` : ''}`,
        `${i.cantidad.toLocaleString('es-AR')} ${i.cantidadUnidad}`,
        money(i.total),
      ];
    });
    autoTable(pdf, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN },
      head: [['Detalle', 'Cantidad', 'Importe']],
      body,
      styles: {
        font: this.familia,
        fontSize: 9,
        textColor: INK,
        lineColor: HAIRLINE,
        lineWidth: 0.2,
        cellPadding: 2.4,
      },
      headStyles: {
        fillColor: [246, 245, 243],
        textColor: MUTED,
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: CONTENIDO - 62 },
        1: { cellWidth: 30, halign: 'right' },
        2: { cellWidth: 32, halign: 'right' },
      },
      theme: 'grid',
    });
    return (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY;
  }

  private totales(pdf: jsPDF, d: PresupuestoPdfDatos, y: number): number {
    y += 6;
    const filas: Array<[string, string, boolean]> = [
      ['Subtotal', money(d.subtotal), false],
      ...(d.cargosDirectos > 0
        ? ([['Cargos', money(d.cargosDirectos), false]] as Array<[string, string, boolean]>)
        : []),
      ['Impuestos', money(d.impuestos), false],
      ['TOTAL', money(d.total), true],
    ];
    for (const [k, v, esTotal] of filas) {
      pdf.setFont(this.familia, esTotal ? 'bold' : 'normal');
      pdf.setFontSize(esTotal ? 12 : 9.5);
      pdf.setTextColor(...(esTotal ? INK : MUTED));
      pdf.text(k, ANCHO - MARGEN - 60, y);
      pdf.setTextColor(...INK);
      pdf.text(v, ANCHO - MARGEN, y, { align: 'right' });
      y += esTotal ? 7 : 5.5;
    }
    return y;
  }

  private pie(pdf: jsPDF, d: PresupuestoPdfDatos, y: number) {
    y += 4;
    pdf.setDrawColor(...HAIRLINE);
    pdf.line(MARGEN, y, ANCHO - MARGEN, y);
    y += 6;
    pdf.setFont(this.familia, 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);

    const bloques: string[] = [];
    if (d.senaSugeridaPct != null && d.senaSugeridaPct > 0) {
      bloques.push(
        `Condiciones de pago: seña del ${d.senaSugeridaPct.toLocaleString('es-AR')}% para iniciar el trabajo, saldo contra entrega.`,
      );
    }
    if (d.fechaValidez) {
      bloques.push(
        `Este presupuesto es válido hasta el ${fechaCorta(d.fechaValidez)}. Pasada esa fecha, los precios pueden actualizarse.`,
      );
    }
    if (d.observaciones) bloques.push(d.observaciones);
    if (d.condicionesTexto) bloques.push(d.condicionesTexto);

    for (const bloque of bloques) {
      const lineas = pdf.splitTextToSize(bloque, CONTENIDO) as string[];
      for (const linea of lineas) {
        if (y > 285) return;
        pdf.text(linea, MARGEN, y);
        y += 4;
      }
      y += 1.5;
    }
  }
}
