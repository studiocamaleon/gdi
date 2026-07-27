import { Injectable, Logger } from '@nestjs/common';
import { jsPDF } from 'jspdf';

import { registrarGeist } from '../administracion/invoicing/geist';
import { formatearMonedaDoc, monedaDe, type Moneda } from '../common/moneda';

/**
 * PDF de la ORDEN DE PAGO: el documento que se le manda al proveedor.
 *
 * Es el espejo del recibo de pago —mismo lenguaje visual, mismos helpers— pero
 * del otro lado del mostrador: allá certificamos que recibimos plata, acá
 * detallamos qué le pagamos y por qué.
 *
 * Con jsPDF y no rasterizando HTML, por lo mismo que los otros cuatro del
 * sistema: texto vectorial y buscable, resultado independiente del navegador,
 * y sin arrastrar un Chromium al contenedor. Ver docs/pdf-sin-puppeteer.
 *
 * Lo que este documento tiene y el recibo no: el detalle de las RETENCIONES.
 * Es la razón principal por la que el proveedor lo pide — necesita el
 * certificado para computarse el pago a cuenta del impuesto.
 */

type RGB = [number, number, number];

// Misma paleta que el recibo, uno a uno.
const PAPER: RGB = [251, 251, 249];
const SURFACE_2: RGB = [246, 245, 242];
const BORDE: RGB = [231, 229, 226];
const HAIRLINE: RGB = [238, 236, 232];
const INK: RGB = [20, 20, 26];
const MUTED: RGB = [110, 110, 118];
const MUTED_2: RGB = [154, 154, 162];
const BLANCO: RGB = [255, 255, 255];
const AMBAR: RGB = [161, 98, 7];
const AMBAR_BG: RGB = [254, 249, 195];
const AMBAR_BORD: RGB = [240, 220, 150];

const ANCHO = 210;
const ALTO = 297;
const MARGEN = 12.7;
const CONTENIDO = ANCHO - MARGEN * 2;

/** El diseño está en px sobre una hoja de 794px; jsPDF mide en pt. */
const pt = (px: number) => px * 0.75;

export type OrdenPagoEgreso = {
  numero: string;
  descripcion: string;
  /** "FA 0001-00012345" o null si no hubo documento. */
  comprobante: string | null;
  /** ISO date. */
  vencimiento: string | null;
  /** Lo imputado a ESTE egreso en este pago, no el total de la factura. */
  monto: number;
};

export type OrdenPagoRetencion = {
  regimen: string;
  monto: number;
};

export type OrdenPagoDoc = {
  numero: string;
  negocio: string;
  empresa?: {
    telefono?: string | null;
    email?: string | null;
    sitioWebLegible?: string | null;
    domicilio?: string | null;
    moneda?: Moneda;
  } | null;
  iniciales: string;
  logoDataUri?: string | null;
  proveedorNombre: string;
  proveedorCuit: string | null;
  /** ISO date. */
  fecha: string;
  registradoPor: string | null;
  metodoNombre: string;
  cuentaTexto: string | null;
  referencia: string | null;
  /** Cheque emitido: la plata sale cuando el banco lo debite. */
  cheque: { numero: string; banco: string; fechaPago: string | null } | null;
  egresos: OrdenPagoEgreso[];
  retenciones: OrdenPagoRetencion[];
  montoBruto: number;
  retencionesTotal: number;
  montoNeto: number;
};

const fechaCorta = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

@Injectable()
export class OrdenPagoPdfService {
  private readonly log = new Logger(OrdenPagoPdfService.name);
  private familia = 'helvetica';
  private moneda: Moneda = monedaDe(null);

  private money(n: number): string {
    return formatearMonedaDoc(n, this.moneda);
  }

  generar(doc: OrdenPagoDoc): Buffer {
    this.moneda = doc.empresa?.moneda ?? monedaDe(null);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.familia = registrarGeist(pdf, this.log, 'la orden de pago');
    pdf.setFont(this.familia, 'normal');

    pdf.setFillColor(...PAPER);
    pdf.rect(0, 0, ANCHO, ALTO, 'F');

    let y = 13.5;
    y = this.encabezado(pdf, doc, y);
    y = this.tiraMeta(pdf, doc, y);
    y = this.detalle(pdf, doc, y + 8);
    y = this.totales(pdf, doc, y + 6);
    if (doc.cheque) this.avisoCheque(pdf, doc, y + 5);
    this.pie(pdf, doc);

    return Buffer.from(pdf.output('arraybuffer'));
  }

  // ── helpers (mismos que el recibo) ───────────────────────────────────

  private texto(
    pdf: jsPDF,
    txt: string,
    x: number,
    y: number,
    o: {
      size?: number;
      bold?: boolean;
      color?: RGB;
      align?: 'left' | 'center' | 'right';
      tracking?: number;
    } = {},
  ) {
    pdf.setFont(this.familia, o.bold ? 'bold' : 'normal');
    pdf.setFontSize(o.size ?? pt(14));
    pdf.setTextColor(...(o.color ?? INK));
    if (o.tracking) pdf.setCharSpace(o.tracking);
    pdf.text(txt, x, y, { align: o.align ?? 'left' });
    if (o.tracking) pdf.setCharSpace(0);
  }

  private recortar(pdf: jsPDF, txt: string, ancho: number, size: number) {
    pdf.setFontSize(size);
    if (pdf.getTextWidth(txt) <= ancho) return txt;
    let corte = txt;
    while (corte.length > 1 && pdf.getTextWidth(corte + '…') > ancho) {
      corte = corte.slice(0, -1);
    }
    return corte.trimEnd() + '…';
  }

  private caja(
    pdf: jsPDF,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    relleno: RGB | null,
    borde: RGB | null,
  ) {
    if (relleno) pdf.setFillColor(...relleno);
    if (borde) pdf.setDrawColor(...borde).setLineWidth(0.3);
    const estilo = relleno && borde ? 'FD' : relleno ? 'F' : 'S';
    pdf.roundedRect(x, y, w, h, r, r, estilo);
  }

  private linea(pdf: jsPDF, x1: number, y: number, x2: number, color: RGB) {
    pdf.setDrawColor(...color).setLineWidth(0.25);
    pdf.line(x1, y, x2, y);
  }

  // ── secciones ────────────────────────────────────────────────────────

  private encabezado(pdf: jsPDF, d: OrdenPagoDoc, y0: number): number {
    const LADO = 13.8;
    let dibujoLogo = false;
    if (
      d.logoDataUri &&
      /^data:image\/(png|jpe?g);base64,/i.test(d.logoDataUri)
    ) {
      try {
        pdf.addImage(d.logoDataUri, MARGEN, y0, LADO, LADO, undefined, 'FAST');
        dibujoLogo = true;
      } catch (error) {
        // Un logo corrupto no puede impedir emitir la orden de pago.
        this.log.warn(
          `No pude dibujar el logo en la orden de pago: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    if (!dibujoLogo) {
      this.caja(pdf, MARGEN, y0, LADO, LADO, 3.7, INK, null);
      this.texto(pdf, d.iniciales, MARGEN + LADO / 2, y0 + LADO / 2 + 1.8, {
        size: pt(19),
        bold: true,
        color: BLANCO,
        align: 'center',
      });
    }

    const xTexto = MARGEN + LADO + 4;
    this.texto(pdf, d.negocio, xTexto, y0 + 5.6, { size: pt(21), bold: true });

    pdf.setFontSize(pt(22)).setFont(this.familia, 'bold');
    const anchoNumero = pdf.getTextWidth(d.numero);
    const anchoLibre = ANCHO - MARGEN - anchoNumero - 5 - xTexto;
    const contacto = [
      d.empresa?.domicilio,
      [d.empresa?.telefono, d.empresa?.email].filter(Boolean).join(' · '),
    ].filter((l): l is string => Boolean(l && l.trim()));
    if (contacto.length === 0) {
      this.texto(pdf, 'Orden de pago a proveedor', xTexto, y0 + 10.6, {
        size: pt(12.5),
        color: MUTED,
      });
    } else {
      contacto.forEach((l, i) =>
        this.texto(
          pdf,
          this.recortar(pdf, l, anchoLibre, pt(11)),
          xTexto,
          y0 + 10 + i * 3.7,
          { size: pt(11), color: MUTED },
        ),
      );
    }

    const xDer = ANCHO - MARGEN;
    this.texto(pdf, 'ORDEN DE PAGO', xDer, y0 + 3, {
      size: pt(10.5),
      bold: true,
      color: MUTED_2,
      align: 'right',
      tracking: 0.5,
    });
    this.texto(pdf, d.numero, xDer, y0 + 10, {
      size: pt(22),
      bold: true,
      align: 'right',
    });

    return y0 + 22;
  }

  private tiraMeta(pdf: jsPDF, d: OrdenPagoDoc, y0: number): number {
    const alto = 15;
    this.linea(pdf, MARGEN, y0, ANCHO - MARGEN, HAIRLINE);
    this.linea(pdf, MARGEN, y0 + alto, ANCHO - MARGEN, HAIRLINE);

    const celdas: Array<[string, string, number]> = [
      [
        'PAGADO A',
        d.proveedorCuit
          ? `${d.proveedorNombre} · CUIT ${d.proveedorCuit}`
          : d.proveedorNombre,
        1.5,
      ],
      ['FECHA', fechaCorta(d.fecha), 0.8],
      ['MEDIO', d.metodoNombre, 1],
      ['N° DE OPERACIÓN', d.referencia ?? '—', 1],
    ];
    const pesoTotal = celdas.reduce((acc, c) => acc + c[2], 0);
    let x = MARGEN;
    for (const [rotulo, valor, peso] of celdas) {
      const ancho = (CONTENIDO * peso) / pesoTotal;
      this.texto(pdf, rotulo, x, y0 + 5.4, {
        size: pt(9.5),
        bold: true,
        color: MUTED_2,
        tracking: 0.4,
      });
      this.texto(
        pdf,
        this.recortar(pdf, valor, ancho - 4, pt(12)),
        x,
        y0 + 10.8,
        { size: pt(12), bold: true },
      );
      x += ancho;
    }
    return y0 + alto;
  }

  /** Qué se está pagando: una fila por egreso imputado. */
  private detalle(pdf: jsPDF, d: OrdenPagoDoc, y0: number): number {
    this.texto(pdf, 'COMPROBANTES CANCELADOS', MARGEN, y0, {
      size: pt(9.5),
      bold: true,
      color: MUTED_2,
      tracking: 0.4,
    });

    let y = y0 + 5;
    const xMonto = ANCHO - MARGEN;
    this.linea(pdf, MARGEN, y, ANCHO - MARGEN, HAIRLINE);
    y += 5.5;

    for (const e of d.egresos) {
      this.texto(
        pdf,
        this.recortar(pdf, e.descripcion, CONTENIDO - 42, pt(12.5)),
        MARGEN,
        y,
        { size: pt(12.5), bold: true },
      );
      this.texto(pdf, this.money(e.monto), xMonto, y, {
        size: pt(12.5),
        bold: true,
        align: 'right',
      });
      const sub = [
        e.numero,
        e.comprobante,
        e.vencimiento ? `vence ${fechaCorta(e.vencimiento)}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      this.texto(pdf, sub, MARGEN, y + 4, { size: pt(10.5), color: MUTED });
      y += 9.5;
      this.linea(pdf, MARGEN, y - 3, ANCHO - MARGEN, HAIRLINE);
    }
    return y;
  }

  /**
   * El bloque de plata. Con retenciones son tres renglones y no uno, porque
   * es exactamente la información que el proveedor necesita: cuánto se le
   * canceló, cuánto se le retuvo y cuánto cobra.
   */
  private totales(pdf: jsPDF, d: OrdenPagoDoc, y0: number): number {
    const hayRet = d.retenciones.length > 0;
    const filas = 1 + d.retenciones.length + (hayRet ? 1 : 0);
    const alto = 9 + filas * 6.5 + 4;
    const x = ANCHO - MARGEN - 86;
    this.caja(pdf, x, y0, 86, alto, 2.5, SURFACE_2, BORDE);

    let y = y0 + 7.5;
    const xEtiq = x + 5;
    const xVal = ANCHO - MARGEN - 5;

    this.texto(pdf, 'Total cancelado', xEtiq, y, {
      size: pt(11.5),
      color: MUTED,
    });
    this.texto(pdf, this.money(d.montoBruto), xVal, y, {
      size: pt(11.5),
      align: 'right',
    });
    y += 6.5;

    for (const r of d.retenciones) {
      this.texto(pdf, `Ret. ${r.regimen}`, xEtiq, y, {
        size: pt(11.5),
        color: MUTED,
      });
      this.texto(pdf, `− ${this.money(r.monto)}`, xVal, y, {
        size: pt(11.5),
        color: AMBAR,
        align: 'right',
      });
      y += 6.5;
    }

    if (hayRet) {
      this.linea(pdf, xEtiq, y - 3.5, xVal, BORDE);
      this.texto(pdf, 'Neto pagado', xEtiq, y + 1, {
        size: pt(13),
        bold: true,
      });
      this.texto(pdf, this.money(d.montoNeto), xVal, y + 1, {
        size: pt(15),
        bold: true,
        align: 'right',
      });
      y += 6.5;
    }

    return y0 + alto;
  }

  /**
   * Con cheque la plata no salió todavía y el documento tiene que decirlo:
   * el proveedor necesita saber que cobra cuando el cheque se acredite.
   */
  private avisoCheque(pdf: jsPDF, d: OrdenPagoDoc, y0: number) {
    if (!d.cheque) return;
    const alto = 13;
    this.caja(pdf, MARGEN, y0, CONTENIDO, alto, 2.5, AMBAR_BG, AMBAR_BORD);
    this.texto(pdf, 'PAGADO CON CHEQUE', MARGEN + 5, y0 + 5.2, {
      size: pt(9.5),
      bold: true,
      color: AMBAR,
      tracking: 0.4,
    });
    const detalle = [
      `N° ${d.cheque.numero}`,
      d.cheque.banco,
      d.cheque.fechaPago ? `al ${fechaCorta(d.cheque.fechaPago)}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    this.texto(pdf, detalle, MARGEN + 5, y0 + 10, {
      size: pt(11.5),
      color: INK,
    });
  }

  private pie(pdf: jsPDF, d: OrdenPagoDoc) {
    const y = ALTO - 20;
    this.linea(pdf, MARGEN, y, ANCHO - MARGEN, HAIRLINE);
    const emitida = d.registradoPor
      ? `Emitida por ${d.registradoPor}`
      : 'Emitida por el sistema';
    this.texto(pdf, emitida, MARGEN, y + 5.5, { size: pt(10.5), color: MUTED });
    if (d.cuentaTexto) {
      this.texto(pdf, d.cuentaTexto, MARGEN, y + 9.8, {
        size: pt(10.5),
        color: MUTED_2,
      });
    }
    // No es un comprobante fiscal y el documento lo dice, igual que el recibo.
    this.texto(
      pdf,
      'Documento no válido como factura',
      ANCHO - MARGEN,
      y + 5.5,
      { size: pt(10.5), color: MUTED_2, align: 'right' },
    );
  }
}
