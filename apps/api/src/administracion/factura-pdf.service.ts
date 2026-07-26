import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

type Documento = Awaited<
  ReturnType<import('./factura.service').FacturaService['documento']>
>;

/**
 * Genera el PDF del comprobante.
 *
 * Se dibuja con jsPDF en vez de rasterizar el HTML por tres razones que
 * importan en un documento fiscal:
 *  - el texto queda VECTORIAL: se puede seleccionar, copiar y buscar, y el
 *    CAE se lee aunque se imprima chico;
 *  - el resultado es determinístico y no depende del navegador ni de la
 *    impresora de quien lo genera;
 *  - no arrastra un Chromium headless (~300 MB) al contenedor de la API.
 *
 * Vive en el server y no en el navegador porque el mismo PDF va a tener que
 * salir por mail al cliente, sin que nadie apriete un botón.
 *
 * Tipografía: Geist incrustada, la misma que usa la app, así que el PDF se
 * ve como el sistema. Los TTF viven en ./fonts (ver su README): next/font
 * sólo expone woff2 y jsPDF necesita TTF. Si por lo que sea no se pueden
 * leer, cae a Helvetica y lo avisa — un comprobante feo es mejor que
 * ninguno.
 */

const MARGEN = 14;
const ANCHO = 210;
const CONTENIDO = ANCHO - MARGEN * 2;

const INK: [number, number, number] = [20, 20, 26];
const MUTED: [number, number, number] = [110, 110, 118];
const MUTED2: [number, number, number] = [146, 146, 155];
const HAIRLINE: [number, number, number] = [239, 236, 232];
const BORDE: [number, number, number] = [212, 210, 205];
const INFO: [number, number, number] = [29, 78, 216];

/**
 * Geist, cargada una vez. nest-cli copia los .ttf a dist manteniendo la
 * estructura, así que __dirname sirve tanto con ts-node como compilado.
 */
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
      `No pude cargar Geist para el PDF (${e instanceof Error ? e.message : e}). ` +
        'El comprobante sale en Helvetica.',
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

const fecha = (iso: string | null) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

@Injectable()
export class FacturaPdfService {
  private readonly log = new Logger(FacturaPdfService.name);
  /** 'Geist' si se pudo incrustar; si no, la Helvetica de jsPDF. */
  private familia = 'helvetica';

  /**
   * `logoDataUri` sólo se dibuja si es PNG o JPEG: jsPDF no rasteriza SVG ni
   * WEBP, y los otros dos formatos que aceptamos como logo terminarían en un
   * cuadro negro. Cuando no se puede, el comprobante sale como siempre — sin
   * logo. Ver docs/archivos-r2-diseno.md
   */
  async generar(doc: Documento, logoDataUri?: string | null): Promise<Buffer> {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.registrarFuente(pdf);
    pdf.setFont(this.familia, 'normal');

    let y = MARGEN;
    y = this.bandaSuperior(pdf, doc, y, this.logoDibujable(logoDataUri));
    y = this.receptor(pdf, doc, y);
    y = this.condiciones(pdf, doc, y);
    y = this.items(pdf, doc, y);
    y = this.totales(pdf, doc, y);
    this.autorizacion(pdf, doc, await this.qrDataUrl(doc.qrUrl), y);

    return Buffer.from(pdf.output('arraybuffer'));
  }

  /** Incrusta Geist en el documento. Sin ella, jsPDF usa su Helvetica. */
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

  /** El QR va como PNG: jsPDF no dibuja SVG. */
  private async qrDataUrl(url: string | null): Promise<string | null> {
    if (!url) return null;
    return QRCode.toDataURL(url, {
      margin: 0,
      errorCorrectionLevel: 'M',
      width: 400,
      color: { dark: '#14141aff', light: '#ffffffff' },
    });
  }

  /** PNG/JPEG o nada: los demás formatos jsPDF los dibuja como un cuadro negro. */
  private logoDibujable(dataUri?: string | null): string | null {
    if (!dataUri) return null;
    return /^data:image\/(png|jpe?g);base64,/i.test(dataUri) ? dataUri : null;
  }

  /** Emisor · recuadro de la letra · datos del comprobante. */
  private bandaSuperior(
    pdf: jsPDF,
    d: Documento,
    y0: number,
    logo: string | null,
  ): number {
    const anchoLetra = 22;
    const xLetra = MARGEN + (CONTENIDO - anchoLetra) / 2;
    const xComp = xLetra + anchoLetra + 8;
    let y = y0;

    // ── Emisor
    const LADO_LOGO = 11;
    if (logo) {
      try {
        pdf.addImage(
          logo,
          MARGEN,
          y - 1,
          LADO_LOGO,
          LADO_LOGO,
          undefined,
          'FAST',
        );
      } catch (error) {
        // Un logo corrupto no puede impedir emitir un comprobante fiscal.
        this.log.warn(
          `No pude dibujar el logo en la factura: ${error instanceof Error ? error.message : String(error)}`,
        );
        logo = null;
      }
    }
    const xEmisor = logo ? MARGEN + LADO_LOGO + 3 : MARGEN;

    pdf
      .setFont(this.familia, 'bold')
      .setFontSize(13)
      .setTextColor(...INK);
    pdf.text(d.emisor.razonSocial, xEmisor, y + 4);

    pdf.setFont(this.familia, 'normal').setFontSize(7.5);
    // Con logo las filas arrancan más abajo para no meterse debajo de él; el
    // bloque es elástico (`Math.max` al final), así que no rompe lo de abajo.
    let yy = y + (logo ? 14 : 11);
    const fila = (k: string, v: string | null) => {
      if (!v) return;
      pdf.setTextColor(...MUTED);
      pdf.text(k, MARGEN, yy);
      pdf.setTextColor(...INK);
      pdf.text(v, MARGEN + 32, yy);
      yy += 4;
    };
    fila('Domicilio comercial', d.emisor.domicilioFiscal);
    fila('Condición frente al IVA', d.emisor.condicionFiscal);
    fila('CUIT', d.emisor.cuit);
    fila('Ingresos Brutos', d.emisor.ingresosBrutos);
    fila('Inicio de actividades', fecha(d.emisor.inicioActividades));
    // Contacto: no lo pide la norma, pero es lo primero que busca el cliente
    // que quiere reclamar algo de una factura.
    fila('Teléfono', d.emisor.telefono);
    fila('Web', d.emisor.sitioWeb);

    // ── Recuadro de la letra: obligatorio por norma
    pdf.setDrawColor(...INK).setLineWidth(0.5);
    pdf.roundedRect(xLetra, y, anchoLetra, 18, 1.5, 1.5, 'S');
    pdf
      .setFont(this.familia, 'bold')
      .setFontSize(24)
      .setTextColor(...INK);
    pdf.text(d.letra, xLetra + anchoLetra / 2, y + 10, { align: 'center' });
    pdf
      .setFont(this.familia, 'normal')
      .setFontSize(6.5)
      .setTextColor(...MUTED);
    pdf.text(`COD. ${d.codigoArca}`, xLetra + anchoLetra / 2, y + 15, {
      align: 'center',
    });

    // ── Comprobante
    pdf
      .setFont(this.familia, 'bold')
      .setFontSize(12)
      .setTextColor(...INK);
    pdf.text(d.tipoLabel, xComp, y + 4);
    pdf.setFontSize(10);
    pdf.text(`${d.puntoVenta} - ${d.numero}`, xComp, y + 10);

    pdf.setFont(this.familia, 'normal').setFontSize(7.5);
    let yc = y + 16;
    const filaC = (k: string, v: string) => {
      pdf.setTextColor(...MUTED);
      pdf.text(k, xComp, yc);
      pdf.setTextColor(...INK);
      pdf.text(v, xComp + 30, yc);
      yc += 4;
    };
    filaC('Fecha de emisión', fecha(d.fecha));
    if (d.vencimientoPago)
      filaC('Venc. para el pago', fecha(d.vencimientoPago));

    y = Math.max(yy, yc, y + 22) + 2;
    pdf.setDrawColor(...INK).setLineWidth(0.6);
    pdf.line(MARGEN, y, ANCHO - MARGEN, y);
    return y + 6;
  }

  private receptor(pdf: jsPDF, d: Documento, y0: number): number {
    let y = y0;
    pdf
      .setFont(this.familia, 'bold')
      .setFontSize(6.5)
      .setTextColor(...MUTED);
    pdf.text('RECEPTOR', MARGEN, y);
    y += 5;

    pdf.setFontSize(8);
    const col2 = MARGEN + CONTENIDO / 2;
    const par = (
      x: number,
      yy: number,
      k: string,
      v: string,
      destacado = false,
    ) => {
      pdf.setFont(this.familia, 'normal').setTextColor(...MUTED);
      pdf.text(k, x, yy);
      pdf.setFont(this.familia, destacado ? 'bold' : 'normal');
      pdf.setTextColor(...(destacado ? INFO : INK));
      pdf.text(v, x + 30, yy);
    };
    par(MARGEN, y, 'Razón social', d.receptor.razonSocial);
    par(col2, y, 'CUIT', d.receptor.cuit ?? '—');
    y += 4.5;
    par(MARGEN, y, 'Domicilio', d.receptor.domicilio ?? '—');
    // RG 5616: la condición del receptor es obligatoria desde 2025.
    par(col2, y, 'Condición IVA', d.receptor.condicionFiscal, true);
    y += 6;

    pdf.setDrawColor(...HAIRLINE).setLineWidth(0.2);
    pdf.line(MARGEN, y, ANCHO - MARGEN, y);
    return y + 5;
  }

  private condiciones(pdf: jsPDF, d: Documento, y0: number): number {
    const y = y0;
    pdf.setFontSize(8);
    pdf.setFont(this.familia, 'normal').setTextColor(...MUTED);
    pdf.text('Condición de venta', MARGEN, y);
    pdf.setFont(this.familia, 'bold').setTextColor(...INK);
    pdf.text(d.condicionVenta, MARGEN + 28, y);

    pdf.setFont(this.familia, 'normal').setTextColor(...MUTED);
    pdf.text('Moneda', MARGEN + 90, y);
    pdf.setFont(this.familia, 'bold').setTextColor(...INK);
    pdf.text(d.moneda, MARGEN + 104, y);

    pdf.setDrawColor(...HAIRLINE).setLineWidth(0.2);
    pdf.line(MARGEN, y + 4, ANCHO - MARGEN, y + 4);
    return y + 9;
  }

  private items(pdf: jsPDF, d: Documento, y0: number): number {
    const head = d.discriminaIva
      ? [
          [
            'Código / Descripción',
            'Cant.',
            'Precio unit.',
            'Alíc. IVA',
            'Subtotal',
          ],
        ]
      : [['Código / Descripción', 'Cant.', 'Precio unit.', 'Subtotal']];

    const body = d.items.map((it) => {
      const desc = it.codigo
        ? `${it.descripcion}\n${it.codigo}`
        : it.descripcion;
      const base = [
        desc,
        String(it.cantidad),
        money(it.precioUnitario),
        money(it.subtotal),
      ];
      if (!d.discriminaIva) return base;
      return [
        desc,
        String(it.cantidad),
        money(it.precioUnitario),
        it.alicuota !== null ? `${it.alicuota}%` : '—',
        money(it.subtotal),
      ];
    });

    autoTable(pdf, {
      head,
      body,
      startY: y0,
      margin: { left: MARGEN, right: MARGEN },
      theme: 'plain',
      styles: {
        font: this.familia,
        fontSize: 8,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
        textColor: INK,
        lineColor: HAIRLINE,
        lineWidth: { bottom: 0.2 },
      },
      headStyles: {
        fontSize: 6.5,
        fontStyle: 'bold',
        textColor: MUTED,
        lineColor: BORDE,
        lineWidth: { bottom: 0.4 },
      },
      columnStyles: d.discriminaIva
        ? {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 14, halign: 'center' },
            2: { cellWidth: 26, halign: 'right' },
            3: { cellWidth: 18, halign: 'center' },
            4: { cellWidth: 28, halign: 'right' },
          }
        : {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 14, halign: 'center' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 32, halign: 'right' },
          },
      // Una fila de ítem no se parte entre dos páginas.
      rowPageBreak: 'avoid',
    });

    const fin = (pdf as unknown as { lastAutoTable: { finalY: number } })
      .lastAutoTable.finalY;
    pdf.setDrawColor(...BORDE).setLineWidth(0.3);
    pdf.line(MARGEN, fin, ANCHO - MARGEN, fin);
    return fin + 6;
  }

  private totales(pdf: jsPDF, d: Documento, y0: number): number {
    const xTot = ANCHO - MARGEN - 62;
    let y = y0;

    // ── Izquierda: transparencia fiscal (B/C) u otros tributos (A)
    if (!d.discriminaIva) {
      // RG 5614: sin discriminar IVA hay que informar igual el contenido.
      const alto = 20;
      pdf.setDrawColor(...BORDE).setLineWidth(0.2);
      pdf.roundedRect(MARGEN, y - 3, 78, alto, 1, 1, 'S');
      pdf
        .setFont(this.familia, 'bold')
        .setFontSize(6.5)
        .setTextColor(...INK);
      const titulo = pdf.splitTextToSize(
        'Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)',
        72,
      ) as string[];
      pdf.text(titulo, MARGEN + 3, y + 1);
      let yl = y + 1 + titulo.length * 3 + 2;
      pdf.setFontSize(7.5);
      const filaT = (k: string, v: number) => {
        pdf.setFont(this.familia, 'normal').setTextColor(...MUTED);
        pdf.text(k, MARGEN + 3, yl);
        pdf.setFont(this.familia, 'bold').setTextColor(...INK);
        pdf.text(money(v), MARGEN + 75, yl, { align: 'right' });
        yl += 4;
      };
      filaT('IVA Contenido', d.ivaContenido ?? 0);
      filaT('Otros Impuestos Nac. Indirectos', d.otrosImpuestosIndirectos ?? 0);
    } else if (d.otrosTributos.length > 0) {
      pdf
        .setFont(this.familia, 'bold')
        .setFontSize(6.5)
        .setTextColor(...MUTED);
      pdf.text('OTROS TRIBUTOS', MARGEN, y);
      let yl = y + 5;
      pdf.setFont(this.familia, 'normal').setFontSize(7.5);
      for (const t of d.otrosTributos) {
        pdf.setTextColor(...MUTED);
        pdf.text(t.descripcion, MARGEN, yl);
        pdf.setTextColor(...INK);
        pdf.text(money(t.monto), MARGEN + 75, yl, { align: 'right' });
        yl += 4;
      }
    }

    // ── Derecha: los totales
    pdf.setFontSize(8);
    const filaTot = (k: string, v: string, sangria = false) => {
      pdf
        .setFont(this.familia, 'normal')
        .setTextColor(...(sangria ? MUTED2 : MUTED));
      pdf.text(k, xTot + (sangria ? 4 : 0), y);
      pdf.setTextColor(...INK);
      pdf.text(v, ANCHO - MARGEN, y, { align: 'right' });
      y += 4.5;
    };
    filaTot('Subtotal', money(d.subtotal));
    if (d.discriminaIva) {
      for (const l of [...d.ivaPorAlicuota].sort(
        (a, b) => b.alicuota - a.alicuota,
      )) {
        filaTot(`IVA ${l.alicuota}%`, money(l.monto), true);
      }
      if (d.otrosTributosTotal > 0) {
        filaTot('Importe otros tributos', money(d.otrosTributosTotal));
      }
    }

    y += 1;
    pdf.setDrawColor(...INK).setLineWidth(0.6);
    pdf.line(xTot, y, ANCHO - MARGEN, y);
    y += 5;
    pdf
      .setFont(this.familia, 'bold')
      .setFontSize(10)
      .setTextColor(...INK);
    pdf.text('Total', xTot, y);
    pdf.setFontSize(13);
    pdf.text(money(d.total), ANCHO - MARGEN, y, { align: 'right' });

    return y + 8;
  }

  private autorizacion(
    pdf: jsPDF,
    d: Documento,
    qr: string | null,
    y0: number,
  ) {
    let y = y0;
    // El bloque de autorización no se parte: si no entra, va a otra página.
    if (y > 240) {
      pdf.addPage();
      y = MARGEN;
    }

    pdf.setDrawColor(...INK).setLineWidth(0.6);
    pdf.line(MARGEN, y, ANCHO - MARGEN, y);
    y += 6;

    const ladoQr = 28;
    if (qr) {
      pdf.addImage(qr, 'PNG', MARGEN, y, ladoQr, ladoQr);
    }

    const xc = MARGEN + ladoQr + 8;
    pdf
      .setFont(this.familia, 'bold')
      .setFontSize(6.5)
      .setTextColor(...MUTED);
    pdf.text(
      d.cae ? 'COMPROBANTE AUTORIZADO — ARCA' : 'SIN AUTORIZACIÓN DE ARCA',
      xc,
      y + 3,
    );

    pdf.setFontSize(6.5).setTextColor(...MUTED);
    pdf.text('CAE N°', xc, y + 9);
    pdf.text('VENCIMIENTO DEL CAE', xc + 46, y + 9);
    pdf
      .setFont(this.familia, 'bold')
      .setFontSize(11)
      .setTextColor(...INK);
    pdf.text(d.cae ?? '—', xc, y + 14);
    pdf.text(fecha(d.caeVencimiento), xc + 46, y + 14);

    // ── Leyendas: son obligatorias, no decorativas
    if (d.leyendas.length > 0) {
      let yl = y + 20;
      pdf.setDrawColor(...HAIRLINE).setLineWidth(0.2);
      pdf.line(xc, yl - 3, ANCHO - MARGEN, yl - 3);
      pdf
        .setFont(this.familia, 'bold')
        .setFontSize(6)
        .setTextColor(...MUTED);
      pdf.text('LEYENDAS', xc, yl);
      yl += 3.5;
      pdf
        .setFont(this.familia, 'normal')
        .setFontSize(6.5)
        .setTextColor(...INK);
      for (const l of d.leyendas) {
        const txt = l.codigo ? `[${l.codigo}] ${l.texto}` : l.texto;
        const lineas = pdf.splitTextToSize(
          txt,
          ANCHO - MARGEN - xc,
        ) as string[];
        pdf.text(lineas, xc, yl);
        yl += lineas.length * 2.8 + 1.5;
      }
    }
  }
}
