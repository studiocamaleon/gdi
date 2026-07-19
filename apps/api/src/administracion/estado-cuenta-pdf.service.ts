import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TRAMOS_AGING, TRAMO_AGING_LABELS } from './aging';

type CuentaCorriente = Awaited<
  ReturnType<import('./cuenta-corriente.service').CuentaCorrienteService['obtener']>
>;

/** Datos del emisor para el encabezado (config fiscal del tenant). */
export type EmisorEstadoCuenta = {
  razonSocial: string;
  cuit: string;
  condicionFiscal: string;
  domicilioFiscal: string | null;
  ingresosBrutos: string | null;
} | null;

/**
 * PDF del estado de cuenta corriente de un cliente. Misma cocina que el
 * comprobante (jsPDF + autoTable + Geist incrustada, ver factura-pdf.service):
 * texto vectorial, determinístico y sin Chromium. La fuente son los mismos
 * datos que la vista web (CuentaCorrienteService.obtener), así que el PDF y la
 * pantalla no pueden divergir.
 */

const MARGEN = 14;
const ANCHO = 210;
const CONTENIDO = ANCHO - MARGEN * 2;

const INK: [number, number, number] = [20, 20, 26];
const MUTED: [number, number, number] = [110, 110, 118];
const HAIRLINE: [number, number, number] = [239, 236, 232];
const OK: [number, number, number] = [22, 121, 74];
const DANGER: [number, number, number] = [194, 65, 12];

let geistCache: { regular: string; bold: string } | null | undefined;

function cargarGeist(log: Logger): { regular: string; bold: string } | null {
  if (geistCache !== undefined) return geistCache;
  try {
    const dir = join(__dirname, 'invoicing', 'fonts');
    geistCache = {
      regular: readFileSync(join(dir, 'Geist-Regular.ttf')).toString('base64'),
      bold: readFileSync(join(dir, 'Geist-Bold.ttf')).toString('base64'),
    };
  } catch (e) {
    log.warn(
      `No pude cargar Geist para el estado de cuenta (${e instanceof Error ? e.message : e}). Sale en Helvetica.`,
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
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/** CUIT normalizado (11 díg.) → 30-71234567-1; si no, tal cual. */
const formatCuit = (cuit: string) => {
  const d = (cuit ?? '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : cuit;
};

const CONDICION_LABEL: Record<string, string> = {
  RI: 'Responsable inscripto',
  MONOTRIBUTO: 'Monotributo',
  EXENTO: 'Exento',
  CF: 'Consumidor final',
  NR: 'No responsable',
};

@Injectable()
export class EstadoCuentaPdfService {
  private readonly log = new Logger(EstadoCuentaPdfService.name);
  private familia = 'helvetica';

  generar(
    cc: CuentaCorriente,
    emisor: EmisorEstadoCuenta = null,
    generadoEl: Date = new Date(),
  ): Buffer {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.registrarFuente(pdf);
    pdf.setFont(this.familia, 'normal');

    let y = MARGEN;
    y = this.encabezado(pdf, cc, emisor, generadoEl, y);
    y = this.resumen(pdf, cc, y);
    y = this.aging(pdf, cc, y);
    this.movimientos(pdf, cc, y);
    this.pieDePagina(pdf);

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

  /** Emisor + rótulo del documento + cliente. */
  private encabezado(
    pdf: jsPDF,
    cc: CuentaCorriente,
    emisor: EmisorEstadoCuenta,
    generadoEl: Date,
    y0: number,
  ): number {
    let y = y0;

    // Columna derecha: rótulo del documento + fecha de generación.
    pdf.setFont(this.familia, 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...INK);
    pdf.text('ESTADO DE CUENTA', ANCHO - MARGEN, y + 4, { align: 'right' });
    pdf.setFont(this.familia, 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    const gen = `${String(generadoEl.getDate()).padStart(2, '0')}/${String(generadoEl.getMonth() + 1).padStart(2, '0')}/${generadoEl.getFullYear()}`;
    pdf.text(`Generado el ${gen}`, ANCHO - MARGEN, y + 9, { align: 'right' });

    // Columna izquierda: emisor (si el tenant configuró sus datos fiscales).
    if (emisor) {
      pdf.setFont(this.familia, 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(...INK);
      pdf.text(emisor.razonSocial, MARGEN, y + 4);
      pdf.setFont(this.familia, 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...MUTED);
      let yy = y + 9;
      const lineas = [
        `CUIT ${formatCuit(emisor.cuit)}  ·  ${CONDICION_LABEL[emisor.condicionFiscal] ?? emisor.condicionFiscal}`,
        emisor.domicilioFiscal || null,
        emisor.ingresosBrutos ? `IIBB ${emisor.ingresosBrutos}` : null,
      ].filter((l): l is string => Boolean(l));
      for (const l of lineas) {
        pdf.text(l, MARGEN, yy);
        yy += 4.2;
      }
      y = Math.max(yy - 4.2, y + 9);
    } else {
      y = y + 9;
    }
    y += 5;

    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.3);
    pdf.line(MARGEN, y, ANCHO - MARGEN, y);
    y += 7;

    // Cliente.
    pdf.setFont(this.familia, 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(...INK);
    pdf.text(cc.cliente.razonSocial || cc.cliente.nombre, MARGEN, y);
    y += 5;

    pdf.setFont(this.familia, 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    const meta = [
      cc.cliente.cuit ? `CUIT ${cc.cliente.cuit}` : null,
      CONDICION_LABEL[cc.cliente.condicionFiscal] ?? cc.cliente.condicionFiscal,
      cc.cliente.vendedor ? `Vendedor: ${cc.cliente.vendedor}` : null,
    ]
      .filter(Boolean)
      .join('  ·  ');
    pdf.text(meta, MARGEN, y);
    y += 6;

    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.3);
    pdf.line(MARGEN, y, ANCHO - MARGEN, y);
    return y + 6;
  }

  /** Saldo actual + estado + límite de crédito. */
  private resumen(pdf: jsPDF, cc: CuentaCorriente, y0: number): number {
    let y = y0;
    pdf.setFont(this.familia, 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    pdf.text('SALDO ACTUAL', MARGEN, y);

    pdf.setFont(this.familia, 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(...(cc.saldo > 0 ? INK : OK));
    pdf.text(money(cc.saldo), MARGEN, y + 8);

    pdf.setFont(this.familia, 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    const estado = `${cc.saldo > 0 ? 'Deudor' : 'Sin deuda'} · ${cc.comprobantesPendientes} ${cc.comprobantesPendientes === 1 ? 'orden' : 'órdenes'} sin cobrar`;
    pdf.text(estado, MARGEN, y + 14);

    // Columna derecha: límite de crédito.
    const xr = MARGEN + CONTENIDO * 0.58;
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    pdf.text('LÍMITE DE CRÉDITO', xr, y);
    pdf.setFontSize(10);
    if (cc.cliente.limiteCredito === null) {
      pdf.setTextColor(...MUTED);
      pdf.text('Sin límite definido', xr, y + 7);
    } else {
      pdf.setFont(this.familia, 'bold');
      pdf.setTextColor(...(cc.excedido ? DANGER : INK));
      pdf.text(money(cc.cliente.limiteCredito), xr, y + 7);
      pdf.setFont(this.familia, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...MUTED);
      const uso =
        cc.usoLimitePct != null ? `Usa ${cc.usoLimitePct}% del límite` : '';
      const alerta = cc.excedido ? `  ·  excede en ${money(cc.excedente)}` : '';
      pdf.text(`${uso}${alerta}`, xr, y + 13);
    }

    return y + 22;
  }

  /** Antigüedad del saldo deudor. Se omite si no hay deuda vencida ni por vencer. */
  private aging(pdf: jsPDF, cc: CuentaCorriente, y0: number): number {
    if (cc.agingTotal <= 0) return y0;
    let y = y0;
    pdf.setFont(this.familia, 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    pdf.text('Antigüedad del saldo', MARGEN, y);
    y += 3;

    autoTable(pdf, {
      startY: y,
      margin: { left: MARGEN, right: MARGEN },
      theme: 'plain',
      styles: { font: this.familia, fontSize: 9, cellPadding: 1.5 },
      body: TRAMOS_AGING.map((t) => [
        TRAMO_AGING_LABELS[t],
        money(cc.aging[t]),
      ]),
      columnStyles: {
        0: { textColor: MUTED },
        1: { halign: 'right', textColor: INK },
      },
      foot: [['Total deudor', money(cc.agingTotal)]],
      footStyles: {
        font: this.familia,
        fontStyle: 'bold',
        fontSize: 9,
        textColor: DANGER,
        halign: 'right',
        fillColor: false as unknown as undefined,
      },
    });
    return (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 8;
  }

  /** Ledger de movimientos, del más viejo al más nuevo (lectura de extracto). */
  private movimientos(pdf: jsPDF, cc: CuentaCorriente, y0: number): number {
    pdf.setFont(this.familia, 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    pdf.text('Movimientos', MARGEN, y0);

    // La vista guarda del más nuevo al más viejo; el extracto lee al revés.
    const filas = [...cc.movimientos].reverse();

    autoTable(pdf, {
      startY: y0 + 3,
      margin: { left: MARGEN, right: MARGEN },
      theme: 'striped',
      headStyles: {
        font: this.familia,
        fontStyle: 'bold',
        fontSize: 8.5,
        fillColor: [246, 246, 244],
        textColor: MUTED,
      },
      styles: { font: this.familia, fontSize: 8.5, cellPadding: 2, textColor: INK },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      head: [['Fecha', 'Concepto', 'Debe', 'Haber', 'Saldo']],
      body: filas.map((m) => [
        fechaCorta(m.fecha),
        `${m.sigla}  ${m.descripcion}`,
        m.debe > 0 ? money(m.debe) : '—',
        m.haber > 0 ? money(m.haber) : '—',
        money(m.saldo),
      ]),
      columnStyles: {
        0: { cellWidth: 22 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
      },
    });
    return (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY;
  }

  /** Numeración de páginas al pie. */
  private pieDePagina(pdf: jsPDF) {
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFont(this.familia, 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...MUTED);
      pdf.text(`${i} / ${total}`, ANCHO - MARGEN, 292, { align: 'right' });
    }
  }
}
