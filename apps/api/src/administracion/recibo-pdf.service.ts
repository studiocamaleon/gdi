import { Injectable, Logger } from '@nestjs/common';
import { jsPDF } from 'jspdf';
import { registrarGeist } from './invoicing/geist';
import {
  formatearMonedaDoc,
  monedaDe,
  type Moneda,
} from '../common/moneda';

/**
 * PDF del recibo de pago (diseño "PDF Recibo de pago" de claude.ai/design).
 *
 * Con jsPDF y no rasterizando el HTML, por lo mismo que los otros tres del
 * sistema: el texto queda vectorial y buscable, el resultado no depende del
 * navegador de quien lo genera, y no arrastra un Chromium al contenedor.
 *
 * El recibo NO es un comprobante fiscal y el documento lo dice: certifica que
 * la imprenta recibió el dinero. Ver docs/recibos-pago-diseno.md
 */

type RGB = [number, number, number];

// Paleta del diseño, uno a uno.
const PAPER: RGB = [251, 251, 249];
const SURFACE: RGB = [255, 255, 255];
const SURFACE_2: RGB = [246, 245, 242];
const SURFACE_3: RGB = [241, 240, 236];
const BORDE: RGB = [231, 229, 226];
const BORDE_FUERTE: RGB = [217, 215, 210];
const HAIRLINE: RGB = [238, 236, 232];
const INK: RGB = [20, 20, 26];
const INK_2: RGB = [44, 44, 51];
const MUTED: RGB = [110, 110, 118];
const MUTED_2: RGB = [154, 154, 162];
const ACCENT: RGB = [217, 100, 42];
const ACCENT_BG: RGB = [253, 241, 234];
const ACCENT_BORD: RGB = [242, 211, 193];
const VERDE: RGB = [22, 121, 74];
const VERDE_BG: RGB = [233, 244, 238];
const VERDE_BORD: RGB = [201, 230, 214];
const VERDE_DOT: RGB = [40, 160, 106];
const BLANCO: RGB = [255, 255, 255];

const ANCHO = 210;
const ALTO = 297;
/** 48px de padding del diseño sobre 794px de ancho ≈ 12.7mm. */
const MARGEN = 12.7;
const CONTENIDO = ANCHO - MARGEN * 2;

/** El diseño está en px sobre una hoja de 794px; jsPDF mide en pt. */
const pt = (px: number) => px * 0.75;

export type ReciboOrden = {
  numero: string;
  /** Qué se está haciendo: el primer item de la orden. */
  detalle: string | null;
  /** Renglón chico: presupuesto de origen, condición de pago. */
  subtitulo: string | null;
  total: number;
  pagosAnteriores: number;
  saldoPendiente: number;
  /** 0-100, cuánto del trabajo quedó abonado con este pago incluido. */
  pctAbonado: number;
};

export type ReciboDoc = {
  numero: string;
  negocio: string;
  /** Contacto del negocio (Configuración › Empresa). Ver `PresupuestoPdfDatos`. */
  empresa?: {
    telefono?: string | null;
    email?: string | null;
    sitioWebLegible?: string | null;
    domicilio?: string | null;
    /** La moneda del tenant. Un PDF cruza fronteras: nunca `$` a secas. */
    moneda?: Moneda;
  } | null;
  iniciales: string;
  logoDataUri?: string | null;
  clienteNombre: string | null;
  /** ISO date (YYYY-MM-DD). */
  fecha: string;
  registradoPor: string | null;
  referencia: string | null;
  monto: number;
  montoEnLetras: string;
  metodoNombre: string;
  /** "Banco Galicia · CBU ***4471" — de dónde entró la plata. */
  cuentaTexto: string | null;
  /** null = pago a cuenta, sin orden contra la cual medir saldo. */
  orden: ReciboOrden | null;
};

const fechaCorta = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

@Injectable()
export class ReciboPdfService {
  private readonly log = new Logger(ReciboPdfService.name);
  private familia = 'helvetica';
  private moneda: Moneda = monedaDe(null);

  /** "AR$ 1.234,56" / "CLP $ 1.235": en papel el símbolo va desambiguado. */
  private money(n: number): string {
    return formatearMonedaDoc(n, this.moneda);
  }

  generar(doc: ReciboDoc): Buffer {
    this.moneda = doc.empresa?.moneda ?? monedaDe(null);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.familia = registrarGeist(pdf, this.log, 'el recibo de pago');
    pdf.setFont(this.familia, 'normal');

    // El papel del diseño no es blanco puro.
    pdf.setFillColor(...PAPER);
    pdf.rect(0, 0, ANCHO, ALTO, 'F');

    // Cada sección devuelve dónde terminó y la siguiente arranca ahí: el
    // bloque del saldo crece o desaparece según haya orden.
    let y = 13.5;
    y = this.encabezado(pdf, doc, y);
    y = this.tiraMeta(pdf, doc, y);
    y = this.hero(pdf, doc, y + 8);
    if (doc.orden) {
      y = this.aplicadoA(pdf, doc.orden, y + 9);
      this.saldo(pdf, doc, doc.orden, y + 4.5);
    } else {
      this.aCuenta(pdf, y + 9);
    }
    // El pie va anclado abajo de la hoja, no debajo de lo anterior.
    this.pie(pdf, doc);

    return Buffer.from(pdf.output('arraybuffer'));
  }

  // ── helpers de dibujo ────────────────────────────────────────────────

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
      /** Espaciado de las mayúsculas chiquitas del diseño. */
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

  /** Recorta a `ancho` con puntos suspensivos: el diseño no envuelve estos textos. */
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

  /** Marca de la imprenta a la izquierda, identidad del documento a la derecha. */
  private encabezado(pdf: jsPDF, d: ReciboDoc, y0: number): number {
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
        // Un logo corrupto no puede impedir emitir el recibo.
        this.log.warn(
          `No pude dibujar el logo en el recibo: ${error instanceof Error ? error.message : String(error)}`,
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

    // Igual que en el presupuesto: debajo del nombre va el contacto y no un
    // subtítulo, porque "RECIBO DE PAGO" ya está en la columna derecha. Se
    // mide contra el ancho libre —el número vive del otro lado— y lo que no
    // entra se cae por el final.
    pdf.setFontSize(pt(22)).setFont(this.familia, 'bold');
    const anchoNumero = pdf.getTextWidth(d.numero);
    pdf.setFontSize(pt(11)).setFont(this.familia, 'normal');
    const contacto = lineasContacto(
      pdf,
      d.empresa,
      ANCHO - MARGEN - anchoNumero - 5 - xTexto,
    );

    if (contacto.length === 0) {
      this.texto(pdf, 'Comprobante de pago', xTexto, y0 + 10.6, {
        size: pt(12.5),
        color: MUTED,
      });
    } else {
      contacto.forEach((l, i) =>
        this.texto(pdf, l, xTexto, y0 + 10 + i * 3.7, {
          size: pt(11),
          color: MUTED,
        }),
      );
    }

    // ── Identidad del documento (derecha)
    const xDer = ANCHO - MARGEN;
    this.texto(pdf, 'RECIBO DE PAGO', xDer, y0 + 3, {
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

    // Píldora "Pago registrado"
    const etiqueta = 'Pago registrado';
    pdf.setFontSize(pt(12)).setFont(this.familia, 'bold');
    const anchoTexto = pdf.getTextWidth(etiqueta);
    const anchoPill = anchoTexto + 11;
    const xPill = xDer - anchoPill;
    const yPill = y0 + 13.5;
    this.caja(pdf, xPill, yPill, anchoPill, 6.6, 3.3, VERDE_BG, VERDE_BORD);
    // El tilde del diseño, a mano: dos segmentos.
    pdf.setDrawColor(...VERDE).setLineWidth(0.55);
    pdf.line(xPill + 3.6, yPill + 3.4, xPill + 4.5, yPill + 4.3);
    pdf.line(xPill + 4.5, yPill + 4.3, xPill + 6.4, yPill + 2.4);
    this.texto(pdf, etiqueta, xPill + 8, yPill + 4.5, {
      size: pt(12),
      bold: true,
      color: VERDE,
    });

    return y0 + 22;
  }

  /** Las cuatro columnas entre hairlines: quién, cuándo, quién lo tomó, referencia. */
  private tiraMeta(pdf: jsPDF, d: ReciboDoc, y0: number): number {
    const alto = 15;
    this.linea(pdf, MARGEN, y0, ANCHO - MARGEN, HAIRLINE);
    this.linea(pdf, MARGEN, y0 + alto, ANCHO - MARGEN, HAIRLINE);

    const celdas: Array<[string, string, number]> = [
      ['RECIBIDO DE', d.clienteNombre ?? '—', 1.3],
      ['FECHA DE PAGO', fechaCorta(d.fecha), 1],
      ['REGISTRADO POR', d.registradoPor ?? '—', 1],
      ['N° DE OPERACIÓN', d.referencia ?? '—', 1.1],
    ];
    const pesoTotal = celdas.reduce((s, c) => s + c[2], 0);

    let x = MARGEN;
    celdas.forEach(([k, v, peso], i) => {
      const w = (CONTENIDO * peso) / pesoTotal;
      if (i > 0) {
        pdf.setDrawColor(...HAIRLINE).setLineWidth(0.25);
        pdf.line(x, y0, x, y0 + alto);
      }
      const xt = i === 0 ? x : x + 4;
      const disponible = w - (i === 0 ? 6 : 10);
      this.texto(pdf, k, xt, y0 + 5.2, {
        size: pt(10),
        bold: true,
        color: MUTED_2,
        tracking: 0.28,
      });
      this.texto(
        pdf,
        this.recortar(pdf, v, disponible, pt(14.5)),
        xt,
        y0 + 11,
        {
          size: pt(14.5),
        },
      );
      x += w;
    });

    return y0 + alto;
  }

  /** El bloque negro: cuánto entró, en números y en letras, y por qué medio. */
  private hero(pdf: jsPDF, d: ReciboDoc, y0: number): number {
    const alto = 34;
    this.caja(pdf, MARGEN, y0, CONTENIDO, alto, 4.8, INK, null);

    const xIzq = MARGEN + 7.4;
    this.texto(pdf, 'RECIBIMOS LA SUMA DE', xIzq, y0 + 7.5, {
      size: pt(11),
      bold: true,
      color: [163, 163, 168],
      tracking: 0.4,
    });
    this.texto(pdf, this.money(d.monto), xIzq, y0 + 18.5, {
      size: pt(40),
      bold: true,
      color: BLANCO,
    });

    // El monto en letras envuelve: es la línea más larga del documento.
    pdf.setFont(this.familia, 'normal').setFontSize(pt(12.5));
    pdf.setTextColor(178, 178, 184);
    const anchoLetras = CONTENIDO * 0.56;
    const lineas = pdf.splitTextToSize(
      d.montoEnLetras,
      anchoLetras,
    ) as string[];
    lineas.slice(0, 2).forEach((linea, i) => {
      pdf.text(linea, xIzq, y0 + 24.5 + i * 4.2);
    });

    // ── Medio de pago (derecha)
    const xDer = ANCHO - MARGEN - 7.4;
    this.texto(pdf, 'MEDIO DE PAGO', xDer, y0 + 7.5, {
      size: pt(10),
      bold: true,
      color: [150, 150, 156],
      align: 'right',
      tracking: 0.34,
    });

    pdf.setFontSize(pt(14)).setFont(this.familia, 'bold');
    const metodo = this.recortar(pdf, d.metodoNombre, CONTENIDO * 0.34, pt(14));
    const anchoMetodo = pdf.getTextWidth(metodo) + 9;
    const xPill = xDer - anchoMetodo;
    pdf.setFillColor(43, 43, 49);
    pdf.setDrawColor(60, 60, 67).setLineWidth(0.3);
    pdf.roundedRect(xPill, y0 + 10.5, anchoMetodo, 7.4, 2.9, 2.9, 'FD');
    this.texto(pdf, metodo, xDer - 4.5, y0 + 15.4, {
      size: pt(14),
      bold: true,
      color: BLANCO,
      align: 'right',
    });

    if (d.cuentaTexto) {
      this.texto(
        pdf,
        this.recortar(pdf, d.cuentaTexto, CONTENIDO * 0.42, pt(11.5)),
        xDer,
        y0 + 22.5,
        { size: pt(11.5), color: [150, 150, 156], align: 'right' },
      );
    }

    return y0 + alto;
  }

  /** Contra qué trabajo se aplicó el pago. */
  private aplicadoA(pdf: jsPDF, orden: ReciboOrden, y0: number): number {
    this.texto(pdf, 'APLICADO A', MARGEN, y0, {
      size: pt(10.5),
      bold: true,
      color: MUTED,
      tracking: 0.3,
    });

    const y = y0 + 3.5;
    const alto = 16.5;
    this.caja(pdf, MARGEN, y, CONTENIDO, alto, 4.3, SURFACE, BORDE);

    // Ícono de documento, dibujado (jsPDF no traga SVG).
    const xIco = MARGEN + 5.3;
    const yIco = y + 3.2;
    this.caja(pdf, xIco, yIco, 10, 10, 2.9, ACCENT_BG, ACCENT_BORD);
    pdf.setDrawColor(...ACCENT).setLineWidth(0.4);
    pdf.roundedRect(xIco + 2.9, yIco + 2.4, 4.2, 5.2, 0.4, 0.4, 'S');
    pdf.line(xIco + 3.9, yIco + 4.1, xIco + 6.1, yIco + 4.1);
    pdf.line(xIco + 3.9, yIco + 5.3, xIco + 6.1, yIco + 5.3);

    const xTexto = xIco + 13.5;
    const anchoDerecha = 34;
    const anchoTexto = ANCHO - MARGEN - 5 - anchoDerecha - xTexto;

    const titulo = orden.detalle
      ? `Orden ${orden.numero} · ${orden.detalle}`
      : `Orden ${orden.numero}`;
    this.texto(
      pdf,
      this.recortar(pdf, titulo, anchoTexto, pt(15.5)),
      xTexto,
      y + 7.4,
      {
        size: pt(15.5),
        bold: true,
      },
    );
    if (orden.subtitulo) {
      this.texto(
        pdf,
        this.recortar(pdf, orden.subtitulo, anchoTexto, pt(12.5)),
        xTexto,
        y + 12.2,
        { size: pt(12.5), color: MUTED },
      );
    }

    const xDer = ANCHO - MARGEN - 5;
    this.texto(pdf, 'Total del trabajo', xDer, y + 7, {
      size: pt(12.5),
      color: MUTED_2,
      align: 'right',
    });
    this.texto(pdf, this.money(orden.total), xDer, y + 12, {
      size: pt(12.5),
      color: MUTED_2,
      align: 'right',
    });

    return y + alto;
  }

  /** El desglose que responde "¿cuánto falta?". */
  private saldo(
    pdf: jsPDF,
    d: ReciboDoc,
    orden: ReciboOrden,
    y0: number,
  ): number {
    const altoFila = 9.2;
    const altoProg = 14;
    const alto = altoFila * 4 + altoProg;

    this.caja(pdf, MARGEN, y0, CONTENIDO, alto, 4.3, SURFACE, BORDE);

    const filas: Array<{
      etiqueta: string;
      valor: number;
      fondo?: RGB;
      color?: RGB;
      fuerte?: boolean;
      grande?: boolean;
    }> = [
      { etiqueta: 'Total del trabajo', valor: orden.total },
      { etiqueta: 'Pagos anteriores', valor: orden.pagosAnteriores },
      {
        etiqueta: 'Este pago',
        valor: d.monto,
        fondo: VERDE_BG,
        color: VERDE,
        fuerte: true,
      },
      {
        etiqueta: 'Saldo pendiente',
        valor: orden.saldoPendiente,
        fondo: SURFACE_2,
        color: INK,
        fuerte: true,
        grande: true,
      },
    ];

    let y = y0;
    filas.forEach((f, i) => {
      if (f.fondo) {
        pdf.setFillColor(...f.fondo);
        // Las filas del medio son rectas; la última llega al borde redondeado.
        if (i === filas.length - 1) {
          pdf.rect(MARGEN + 0.15, y, CONTENIDO - 0.3, altoFila, 'F');
        } else {
          pdf.rect(MARGEN + 0.15, y, CONTENIDO - 0.3, altoFila, 'F');
        }
      }
      if (i > 0) this.linea(pdf, MARGEN, y, ANCHO - MARGEN, HAIRLINE);

      this.texto(pdf, f.etiqueta, MARGEN + 6, y + 6, {
        size: pt(14),
        bold: f.fuerte,
        color: f.color ?? MUTED,
      });
      this.texto(pdf, this.money(f.valor), ANCHO - MARGEN - 6, y + 6, {
        size: f.grande ? pt(16) : pt(14),
        bold: f.fuerte,
        color: f.color ?? INK_2,
        align: 'right',
      });
      y += altoFila;
    });

    // ── Barra de progreso
    this.linea(pdf, MARGEN, y, ANCHO - MARGEN, HAIRLINE);
    const xBarra = MARGEN + 6;
    const anchoBarra = CONTENIDO - 12;
    const yBarra = y + 4.5;
    this.caja(pdf, xBarra, yBarra, anchoBarra, 2.1, 1.05, SURFACE_3, null);
    const pct = Math.max(0, Math.min(100, orden.pctAbonado));
    if (pct > 0) {
      this.caja(
        pdf,
        xBarra,
        yBarra,
        Math.max(2.1, (anchoBarra * pct) / 100),
        2.1,
        1.05,
        VERDE_DOT,
        null,
      );
    }

    this.texto(pdf, `${Math.round(pct)}% abonado`, xBarra, yBarra + 6.4, {
      size: pt(11.5),
      bold: true,
      color: INK_2,
    });
    this.texto(
      pdf,
      orden.saldoPendiente > 0 ? 'Saldo contra entrega' : 'Trabajo saldado',
      ANCHO - MARGEN - 6,
      yBarra + 6.4,
      { size: pt(11.5), color: MUTED, align: 'right' },
    );

    return y0 + alto;
  }

  /** Un cobro sin orden: no hay trabajo contra el cual medir saldo. */
  private aCuenta(pdf: jsPDF, y0: number): number {
    const alto = 16;
    this.caja(pdf, MARGEN, y0, CONTENIDO, alto, 4.3, SURFACE_2, BORDE);
    this.texto(pdf, 'Pago a cuenta', MARGEN + 7, y0 + 7, {
      size: pt(15),
      bold: true,
    });
    this.texto(
      pdf,
      'No se aplicó a una orden puntual: queda a favor en la cuenta del cliente.',
      MARGEN + 7,
      y0 + 12,
      { size: pt(12.5), color: MUTED },
    );
    return y0 + alto;
  }

  /** Aclaración fiscal, firmas y cierre — anclados abajo de la hoja. */
  private pie(pdf: jsPDF, d: ReciboDoc) {
    const yBase = ALTO - 62;

    // ── Aclaración: es lo que evita que confundan el recibo con una factura.
    const altoNota = 15;
    this.caja(pdf, MARGEN, yBase, CONTENIDO, altoNota, 3.7, SURFACE_2, BORDE);
    pdf.setDrawColor(...MUTED).setLineWidth(0.35);
    pdf.circle(MARGEN + 6.5, yBase + 7.5, 2.5, 'S');
    this.texto(pdf, 'i', MARGEN + 6.5, yBase + 8.7, {
      size: pt(11),
      bold: true,
      color: MUTED,
      align: 'center',
    });

    const xNota = MARGEN + 12;
    const anchoNota = CONTENIDO - 18;
    this.texto(
      pdf,
      'Este documento no es un comprobante fiscal.',
      xNota,
      yBase + 5.6,
      { size: pt(12.5), bold: true, color: INK_2 },
    );
    pdf.setFont(this.familia, 'normal').setFontSize(pt(12.5));
    pdf.setTextColor(...INK_2);
    const cuerpo = pdf.splitTextToSize(
      `Es un recibo interno que certifica el pago registrado entre el cliente y ${d.negocio}. La factura correspondiente se emite por separado.`,
      anchoNota,
    ) as string[];
    cuerpo.slice(0, 2).forEach((linea, i) => {
      pdf.text(linea, xNota, yBase + 10 + i * 4);
    });

    // ── Firmas
    const yFirmas = yBase + altoNota + 18;
    const anchoFirma = (CONTENIDO - 16) / 2;
    const firmas: Array<[string, string]> = [
      [d.clienteNombre ?? 'Cliente', 'CLIENTE'],
      [d.negocio, 'RECIBÍ CONFORME'],
    ];
    firmas.forEach(([nombre, rol], i) => {
      const x = MARGEN + i * (anchoFirma + 16);
      const centro = x + anchoFirma / 2;
      pdf.setDrawColor(...BORDE_FUERTE).setLineWidth(0.3);
      pdf.line(x, yFirmas, x + anchoFirma, yFirmas);
      this.texto(
        pdf,
        this.recortar(pdf, nombre, anchoFirma, pt(12)),
        centro,
        yFirmas + 4.5,
        { size: pt(12), color: MUTED, align: 'center' },
      );
      this.texto(pdf, rol, centro, yFirmas + 8.5, {
        size: pt(10.5),
        bold: true,
        color: MUTED_2,
        align: 'center',
        tracking: 0.25,
      });
    });

    // ── Cierre
    const yCierre = yFirmas + 18;
    this.linea(pdf, MARGEN, yCierre, ANCHO - MARGEN, HAIRLINE);
    this.texto(
      pdf,
      `Gracias por confiar en ${d.negocio}.`,
      MARGEN,
      yCierre + 5,
      { size: pt(11.5), color: MUTED_2 },
    );
    const marca = 'Generado con Grafoprint';
    this.texto(pdf, marca, ANCHO - MARGEN, yCierre + 5, {
      size: pt(11.5),
      color: MUTED_2,
      align: 'right',
    });
    pdf.setFontSize(pt(11.5));
    const anchoMarca = pdf.getTextWidth(marca);
    const xG = ANCHO - MARGEN - anchoMarca - 6;
    this.caja(pdf, xG, yCierre + 1.6, 4.2, 4.2, 1.3, INK, null);
    this.texto(pdf, 'G', xG + 2.1, yCierre + 4.7, {
      size: pt(9),
      bold: true,
      color: BLANCO,
      align: 'center',
    });
  }
}

/**
 * Los dos renglones de contacto del encabezado, recortados a lo que entra.
 *
 * Gemelo del de `presupuesto-pdf.service.ts`: los dos documentos tienen la
 * misma cabecera (marca a la izquierda, número a la derecha) y el mismo
 * problema —jsPDF no corta ni avisa, así que un dominio largo se escribe
 * encima del número—. No se comparte el código porque cada servicio dibuja
 * con sus propias unidades; sí se comparte el criterio: el mail es lo primero
 * que se cae, que es lo que menos se usa desde un papel.
 */
function lineasContacto(
  pdf: jsPDF,
  empresa: ReciboDoc['empresa'],
  disponible: number,
): string[] {
  if (!empresa) return [];

  const partes = [empresa.telefono, empresa.sitioWebLegible, empresa.email]
    .map((x) => x?.trim())
    .filter(Boolean) as string[];

  let contacto = '';
  for (let corte = partes.length; corte > 0; corte--) {
    contacto = partes.slice(0, corte).join('  ·  ');
    if (pdf.getTextWidth(contacto) <= disponible) break;
    contacto = '';
  }

  const domicilio = empresa.domicilio?.trim() ?? '';
  return [
    pdf.getTextWidth(domicilio) <= disponible ? domicilio : '',
    contacto,
  ].filter(Boolean);
}
