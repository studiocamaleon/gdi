import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsPDF } from 'jspdf';

/**
 * PDF del presupuesto, dibujado con jsPDF.
 *
 * Es un port del diseño canónico (claude.ai/design · "PDF Presupuesto.html"),
 * que antes se rasterizaba con Chrome headless. Se volvió a jsPDF a propósito
 * (decisión 2026-07-22): el render por PDF ya no era el problema —desde que
 * los PDF se guardan, se genera uno por presupuesto y no uno por visita— pero
 * Puppeteer arrastra 193 MB de Chrome al contenedor de la API, y eso pesa en
 * cada deploy y en el piso de memoria de cada instancia.
 *
 * Lo que se gana además: el texto queda VECTORIAL (se puede buscar y copiar,
 * y el número del presupuesto se lee aunque se imprima chico) y el resultado
 * es determinístico, sin depender de la versión de Chrome.
 *
 * Lo que se pierde: no hay motor de layout. Cada cambio del diseño hay que
 * traducirlo a coordenadas acá. Por eso las medidas están todas derivadas del
 * CSS original con un factor explícito (ver `px`/`pt`), en vez de números
 * mágicos: si el diseño cambia, se re-traduce leyendo el CSS.
 */

// ── Traducción de unidades ───────────────────────────────────────────────
// El diseño está en px sobre un pliego de 794px = 210mm (96dpi).
const PX_A_MM = 210 / 794;
/** Medida del CSS en px → mm del PDF. */
const px = (n: number) => n * PX_A_MM;
/** Tamaño de fuente del CSS en px → puntos (96dpi → 72pt/pulgada). */
const pt = (n: number) => n * 0.75;

const ANCHO = 210;
const ALTO = 297;
const MARGEN = px(48);
const CONTENIDO = ANCHO - MARGEN * 2;

type RGB = [number, number, number];

const PAPEL: RGB = [251, 251, 249];
const SURFACE: RGB = [255, 255, 255];
const SURFACE_2: RGB = [246, 245, 242];
const BORDE: RGB = [231, 229, 226];
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

const fecha = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** Iniciales del negocio para el cuadrado del logo (fallback sin imagen). */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'GP';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export type PresupuestoPdfDatos = {
  numero: string;
  negocio: string;
  /**
   * Logo del tenant como data URI. Sólo se dibuja si es PNG o JPEG: jsPDF no
   * rasteriza SVG ni WEBP, y los dibujaría como un cuadro negro. Cuando no se
   * puede, salen las iniciales — el fallback original del diseño.
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
export class PresupuestoPdfService {
  private readonly log = new Logger(PresupuestoPdfService.name);
  private familia = 'helvetica';

  generar(d: PresupuestoPdfDatos): Promise<Buffer> {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.registrarFuente(pdf);
    this.fondo(pdf);

    let y = this.cabecera(pdf, d);
    y = this.meta(pdf, d, y);
    y = this.detalle(pdf, d, y);
    y = this.totales(pdf, d, y);
    this.pie(pdf, d, y);

    return Promise.resolve(Buffer.from(pdf.output('arraybuffer')));
  }

  // ── Infraestructura ────────────────────────────────────────────────

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

  /** El pliego del diseño es hueso, no blanco puro. */
  private fondo(pdf: jsPDF) {
    pdf.setFillColor(...PAPEL);
    pdf.rect(0, 0, ANCHO, ALTO, 'F');
  }

  private fuente(pdf: jsPDF, tamPx: number, negrita = false, color: RGB = INK) {
    pdf.setFont(this.familia, negrita ? 'bold' : 'normal');
    pdf.setFontSize(pt(tamPx));
    pdf.setTextColor(...color);
  }

  /**
   * Salto de página con el fondo repintado. Devuelve la Y de arranque del
   * contenido en la hoja nueva.
   */
  private nuevaPagina(pdf: jsPDF): number {
    pdf.addPage();
    this.fondo(pdf);
    return px(48);
  }

  /**
   * Pastilla redondeada con texto. Devuelve el ancho que ocupó, para poder
   * ir acomodándolas en fila y saber cuándo cortar el renglón.
   */
  private pastilla(
    pdf: jsPDF,
    x: number,
    y: number,
    partes: Array<{ texto: string; color: RGB; negrita?: boolean }>,
    opciones: {
      tamPx: number;
      fondo: RGB;
      borde: RGB;
      padX: number;
      alto: number;
      gap?: number;
      /** Tilde del diseño en los adicionales incluidos. */
      tilde?: RGB;
    },
  ): number {
    const gap = opciones.gap ?? px(7);
    let ancho = opciones.padX * 2;
    if (opciones.tilde) ancho += px(14) + gap;
    partes.forEach((p, i) => {
      this.fuente(pdf, opciones.tamPx, p.negrita);
      ancho += pdf.getTextWidth(p.texto) + (i > 0 ? gap : 0);
    });

    pdf.setFillColor(...opciones.fondo);
    pdf.setDrawColor(...opciones.borde);
    pdf.setLineWidth(0.2);
    // Radio = mitad del alto: es el `border-radius:999px` del diseño.
    pdf.roundedRect(
      x,
      y,
      ancho,
      opciones.alto,
      opciones.alto / 2,
      opciones.alto / 2,
      'FD',
    );

    let cursor = x + opciones.padX;
    if (opciones.tilde) {
      this.tilde(pdf, cursor, y + opciones.alto / 2, opciones.tilde);
      cursor += px(14) + gap;
    }
    partes.forEach((p, i) => {
      this.fuente(pdf, opciones.tamPx, p.negrita, p.color);
      pdf.text(p.texto, cursor + (i > 0 ? gap : 0), y + opciones.alto / 2, {
        baseline: 'middle',
      });
      cursor += pdf.getTextWidth(p.texto) + (i > 0 ? gap : 0);
    });
    return ancho;
  }

  /** El check de los opcionales, dibujado a mano (jsPDF no toma SVG). */
  private tilde(pdf: jsPDF, x: number, yMedio: number, color: RGB) {
    pdf.setDrawColor(...color);
    pdf.setLineWidth(0.45);
    pdf.setLineCap('round');
    pdf.setLineJoin('round');
    const l = px(14);
    pdf.lines(
      [
        [l * 0.36, l * 0.34],
        [l * 0.62, -l * 0.66],
      ],
      x + l * 0.02,
      yMedio - l * 0.02,
    );
  }

  // ── Bloques ────────────────────────────────────────────────────────

  private cabecera(pdf: jsPDF, d: PresupuestoPdfDatos): number {
    const y = px(40);
    const lado = px(52);

    const logo = /^data:image\/(png|jpe?g);base64,/i.test(d.logoDataUri ?? '')
      ? d.logoDataUri!
      : null;

    if (logo) {
      try {
        pdf.addImage(logo, MARGEN, y, lado, lado, undefined, 'FAST');
      } catch (e) {
        this.log.warn(
          `No pude dibujar el logo (${e instanceof Error ? e.message : e}); van las iniciales.`,
        );
        this.cuadradoIniciales(pdf, MARGEN, y, lado, d.negocio);
      }
    } else {
      this.cuadradoIniciales(pdf, MARGEN, y, lado, d.negocio);
    }

    const xTexto = MARGEN + lado + px(15);
    this.fuente(pdf, 21, true);
    pdf.text(d.negocio, xTexto, y + px(21));
    this.fuente(pdf, 12.5, false, MUTED);
    pdf.text('Presupuesto comercial', xTexto, y + px(21) + px(17));

    // ── Columna derecha: rótulo, número y pastilla de validez
    const der = ANCHO - MARGEN;
    this.fuente(pdf, 10.5, true, MUTED_2);
    pdf.text(this.espaciado('PRESUPUESTO'), der, y + px(9), {
      align: 'right',
    });
    this.fuente(pdf, 22, true);
    pdf.text(d.numero, der, y + px(31), { align: 'right' });

    let yFin = y + lado;
    if (d.fechaValidez) {
      const alto = px(25);
      const texto = `Válido hasta ${fecha(d.fechaValidez)}`;
      this.fuente(pdf, 12, false);
      const ancho = px(12) * 2 + px(7) * 2 + px(7) + pdf.getTextWidth(texto);
      const xPill = der - ancho;
      const yPill = y + px(41);
      pdf.setFillColor(...VERDE_BG);
      pdf.setDrawColor(...VERDE_BORD);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(xPill, yPill, ancho, alto, alto / 2, alto / 2, 'FD');
      pdf.setFillColor(...VERDE_DOT);
      pdf.circle(xPill + px(12) + px(3.5), yPill + alto / 2, px(3.5), 'F');
      this.fuente(pdf, 12, false, VERDE);
      pdf.text(texto, xPill + px(12) + px(7) + px(7), yPill + alto / 2, {
        baseline: 'middle',
      });
      yFin = Math.max(yFin, yPill + alto);
    }

    return yFin + px(26);
  }

  private cuadradoIniciales(
    pdf: jsPDF,
    x: number,
    y: number,
    lado: number,
    negocio: string,
  ) {
    pdf.setFillColor(...INK);
    pdf.roundedRect(x, y, lado, lado, px(14), px(14), 'F');
    this.fuente(pdf, 19, true, [255, 255, 255]);
    pdf.text(iniciales(negocio), x + lado / 2, y + lado / 2 + px(2), {
      align: 'center',
      baseline: 'middle',
    });
  }

  /**
   * `letter-spacing` a mano: jsPDF no lo soporta, y los rótulos del diseño
   * dependen de él para leerse como versalitas.
   */
  private espaciado(texto: string): string {
    return texto.split('').join(' ');
  }

  private meta(pdf: jsPDF, d: PresupuestoPdfDatos, y0: number): number {
    // Las cuatro columnas del diseño: 1.3fr 1fr 1fr 1.1fr.
    const pesos = [1.3, 1, 1, 1.1];
    const suma = pesos.reduce((a, b) => a + b, 0);
    const campos = [
      { k: 'Cliente', v: d.cliente ?? '—' },
      { k: 'Fecha', v: fecha(d.fechaEmision) },
      { k: 'Válido hasta', v: fecha(d.fechaValidez) },
      { k: 'Vendedor', v: d.vendedor ?? '—' },
    ];

    // El nombre del cliente puede no entrar en su columna. Cortarlo en
    // silencio es lo peor que se puede hacer en el documento que ese mismo
    // cliente va a leer, así que la banda crece a dos renglones — que es lo
    // que haría el CSS original, donde el valor no tiene truncado.
    const anchos = pesos.map((p) => (CONTENIDO * p) / suma);
    this.fuente(pdf, 14.5);
    const lineasPorCampo = campos.map((c, i) => {
      const util = anchos[i] - (i > 0 ? px(22) : 0) - px(22);
      const l = pdf.splitTextToSize(c.v, Math.max(util, px(40))) as string[];
      return l.slice(0, 2);
    });
    const maxLineas = Math.max(...lineasPorCampo.map((l) => l.length));
    const alto = px(16) * 2 + px(14) + px(6) + (maxLineas - 1) * px(19);

    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.2);
    pdf.line(MARGEN, y0, ANCHO - MARGEN, y0);
    pdf.line(MARGEN, y0 + alto, ANCHO - MARGEN, y0 + alto);

    let x = MARGEN;
    campos.forEach((c, i) => {
      if (i > 0) {
        pdf.setDrawColor(...HAIRLINE);
        pdf.line(x, y0, x, y0 + alto);
      }
      const xTexto = x + (i > 0 ? px(22) : 0);
      this.fuente(pdf, 10, true, MUTED_2);
      pdf.text(this.espaciado(c.k.toUpperCase()), xTexto, y0 + px(16) + px(6));
      this.fuente(pdf, 14.5, false, INK);
      lineasPorCampo[i].forEach((l, j) => {
        pdf.text(l, xTexto, y0 + px(16) + px(6) + px(14) + j * px(19));
      });
      x += anchos[i];
    });

    return y0 + alto + px(28);
  }

  private detalle(pdf: jsPDF, d: PresupuestoPdfDatos, y0: number): number {
    let y = y0;
    this.fuente(pdf, 10.5, true, MUTED);
    pdf.text(this.espaciado('DETALLE'), MARGEN, y);
    y += px(14) + px(6);

    for (const item of d.items) {
      const alto = this.medirItem(pdf, item);
      // `break-inside: avoid` del diseño: la tarjeta no se parte al medio.
      if (y + alto > ALTO - px(90)) y = this.nuevaPagina(pdf);
      this.dibujarItem(pdf, item, y, d.items.indexOf(item) + 1, alto);
      y += alto + px(12);
    }
    return y;
  }

  /**
   * Nombre partido en como mucho dos renglones, con el ancho que sobra a la
   * izquierda del precio. Lo usan `medirItem` y `dibujarItem`, que TIENEN que
   * coincidir: si midiera distinto de lo que dibuja, la paginación cortaría
   * tarjetas al medio.
   */
  private lineasNombre(
    pdf: jsPDF,
    item: PresupuestoPdfDatos['items'][number],
  ): string[] {
    this.fuente(pdf, 18, true);
    const anchoPrecio = pdf.getTextWidth(money(item.total));
    const xNombre = MARGEN + px(22) + px(30) + px(16);
    const util = MARGEN + CONTENIDO - px(22) - anchoPrecio - px(12) - xNombre;
    this.fuente(pdf, 17, true);
    const lineas = pdf.splitTextToSize(
      item.nombre,
      Math.max(util, px(80)),
    ) as string[];
    if (lineas.length <= 2) return lineas;
    // Más de dos renglones desbalancea la tarjeta: se corta con puntos
    // suspensivos en vez de dejar la frase colgada a la mitad.
    return [lineas[0], `${lineas[1].replace(/\s+\S*$/, '')}…`];
  }

  /** Alto de la tarjeta, calculado igual que se dibuja (para paginar). */
  private medirItem(
    pdf: jsPDF,
    item: PresupuestoPdfDatos['items'][number],
  ): number {
    let alto = px(20) * 2 + px(30);
    const lineas = this.lineasNombre(pdf, item);
    if (lineas.length > 1) alto += (lineas.length - 1) * px(21);
    if (item.specs.length > 0) {
      alto +=
        px(15) + this.altoPastillas(pdf, this.anchosSpecs(pdf, item), px(28));
    }
    if (item.adicionales.length > 0) {
      alto +=
        px(16) +
        px(10.5) +
        px(9) +
        this.altoPastillas(pdf, this.anchosOpcionales(pdf, item), px(25));
    }
    return alto;
  }

  private anchosSpecs(
    pdf: jsPDF,
    item: PresupuestoPdfDatos['items'][number],
  ): number[] {
    return item.specs.map((s) => {
      this.fuente(pdf, 12.5);
      return (
        px(13) * 2 +
        px(7) +
        pdf.getTextWidth(s.etiqueta) +
        pdf.getTextWidth(s.valor)
      );
    });
  }

  private anchosOpcionales(
    pdf: jsPDF,
    item: PresupuestoPdfDatos['items'][number],
  ): number[] {
    return item.adicionales.map((a) => {
      this.fuente(pdf, 12.5);
      return px(9) + px(13) + px(14) + px(7) + pdf.getTextWidth(a);
    });
  }

  /**
   * X donde arranca el contenido interno del item: alineado con el nombre,
   * no con el badge del índice (`padding-left:46px` del diseño, sobre el
   * padding de 22px de la tarjeta).
   */
  private get xContenidoItem(): number {
    return MARGEN + px(22) + px(46);
  }

  private get utilContenidoItem(): number {
    return MARGEN + CONTENIDO - px(22) - this.xContenidoItem;
  }

  /** Cuánto ocupan las pastillas acomodadas en filas con wrap. */
  private altoPastillas(
    pdf: jsPDF,
    anchos: number[],
    altoFila: number,
  ): number {
    const util = this.utilContenidoItem;
    let filas = 1;
    let x = 0;
    for (const a of anchos) {
      if (x > 0 && x + a > util) {
        filas += 1;
        x = 0;
      }
      x += a + px(8);
    }
    return filas * altoFila + (filas - 1) * px(8);
  }

  private dibujarItem(
    pdf: jsPDF,
    item: PresupuestoPdfDatos['items'][number],
    y: number,
    indice: number,
    alto: number,
  ) {
    pdf.setFillColor(...SURFACE);
    pdf.setDrawColor(...BORDE);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(MARGEN, y, CONTENIDO, alto, px(16), px(16), 'FD');

    const xPad = MARGEN + px(22);
    const yPad = y + px(20);

    // Índice del item
    const ladoIdx = px(30);
    pdf.setFillColor(...ACCENT_BG);
    pdf.setDrawColor(...ACCENT_BORD);
    pdf.roundedRect(xPad, yPad, ladoIdx, ladoIdx, px(9), px(9), 'FD');
    this.fuente(pdf, 13, true, ACCENT);
    pdf.text(String(indice), xPad + ladoIdx / 2, yPad + ladoIdx / 2, {
      align: 'center',
      baseline: 'middle',
    });

    // Precio a la derecha; el nombre se corta antes de pisarlo.
    const precio = money(item.total);
    this.fuente(pdf, 18, true);
    pdf.text(precio, MARGEN + CONTENIDO - px(22), yPad + px(13), {
      align: 'right',
    });

    const xNombre = xPad + ladoIdx + px(16);
    const lineas = this.lineasNombre(pdf, item);
    this.fuente(pdf, 17, true);
    lineas.forEach((l, i) => pdf.text(l, xNombre, yPad + px(13) + i * px(21)));
    const yBajoNombre = yPad + px(13) + (lineas.length - 1) * px(21);

    const unit = item.cantidad > 0 ? item.total / item.cantidad : item.total;
    this.fuente(pdf, 12.5, false, MUTED);
    const cant = `${item.cantidad.toLocaleString('es-AR')} ${item.cantidadUnidad} · ${money(unit)} c/u`;
    // El ancho se mide ANTES de cambiar el cuerpo: getTextWidth usa el tamaño
    // vigente, así que medirlo con la fuente del "IVA incl." (más chica) daba
    // un ancho corto y las dos leyendas se pisaban.
    const anchoCant = pdf.getTextWidth(cant);
    pdf.text(cant, xNombre, yBajoNombre + px(15));
    this.fuente(pdf, 11, false, MUTED_2);
    pdf.text('IVA incl.', xNombre + anchoCant + px(6), yBajoNombre + px(15));

    let yCursor = yPad + px(30) + (lineas.length - 1) * px(21);

    if (item.specs.length > 0) {
      yCursor += px(15);
      yCursor = this.filaPastillas(
        pdf,
        this.xContenidoItem,
        yCursor,
        item.specs.map((s) => ({
          partes: [
            { texto: s.etiqueta, color: MUTED_2 },
            { texto: s.valor, color: INK_2 },
          ],
          tamPx: 12.5,
          fondo: SURFACE_2,
          borde: BORDE,
          padX: px(13),
          alto: px(28),
        })),
      );
    }

    if (item.adicionales.length > 0) {
      yCursor += px(16);
      this.fuente(pdf, 10.5, true, VERDE);
      pdf.text(
        this.espaciado('OPCIONALES INCLUIDOS'),
        this.xContenidoItem,
        yCursor,
      );
      yCursor += px(9) + px(6);
      this.filaPastillas(
        pdf,
        this.xContenidoItem,
        yCursor,
        item.adicionales.map((a) => ({
          partes: [{ texto: a, color: VERDE }],
          tamPx: 12.5,
          fondo: VERDE_BG,
          borde: VERDE_BORD,
          padX: px(11),
          alto: px(25),
          tilde: VERDE,
        })),
      );
    }
  }

  /** Acomoda pastillas en filas con wrap. Devuelve la Y del final. */
  private filaPastillas(
    pdf: jsPDF,
    x0: number,
    y0: number,
    pastillas: Array<{
      partes: Array<{ texto: string; color: RGB; negrita?: boolean }>;
      tamPx: number;
      fondo: RGB;
      borde: RGB;
      padX: number;
      alto: number;
      tilde?: RGB;
    }>,
  ): number {
    const util = MARGEN + CONTENIDO - px(22) - x0;
    let x = x0;
    let y = y0;
    for (const p of pastillas) {
      const ancho = this.pastilla(pdf, -1000, -1000, p.partes, p); // medir
      if (x > x0 && x + ancho > x0 + util) {
        x = x0;
        y += p.alto + px(8);
      }
      this.pastilla(pdf, x, y, p.partes, p);
      x += ancho + px(8);
    }
    return y + (pastillas[0]?.alto ?? 0);
  }

  private totales(pdf: jsPDF, d: PresupuestoPdfDatos, y0: number): number {
    const anchoCaja = px(340);
    const x = ANCHO - MARGEN - anchoCaja;
    const pctIva =
      d.subtotal > 0 ? Math.round((d.impuestos / d.subtotal) * 100) : 0;

    const filas: Array<[string, number]> = [['Subtotal', d.subtotal]];
    if (d.cargosDirectos > 0) filas.push(['Cargos directos', d.cargosDirectos]);
    filas.push([
      d.impuestos > 0 && pctIva > 0
        ? `Impuestos (IVA ${pctIva}%)`
        : 'Impuestos',
      d.impuestos,
    ]);

    const altoTotal = px(26) + filas.length * px(31) + px(10) + px(56);
    let y = y0 + px(26);
    if (y + altoTotal > ALTO - px(40)) y = this.nuevaPagina(pdf) + px(26);

    for (const [k, v] of filas) {
      this.fuente(pdf, 14, false, MUTED);
      pdf.text(k, x + px(4), y + px(9) + px(6));
      this.fuente(pdf, 14, false, INK_2);
      pdf.text(money(v), x + anchoCaja - px(4), y + px(9) + px(6), {
        align: 'right',
      });
      y += px(31);
    }

    y += px(10);
    const altoCaja = px(56);
    pdf.setFillColor(...INK);
    pdf.roundedRect(x, y, anchoCaja, altoCaja, px(14), px(14), 'F');
    this.fuente(pdf, 12, true, [255, 255, 255]);
    pdf.setTextColor(255, 255, 255);
    pdf.text(this.espaciado('TOTAL'), x + px(20), y + altoCaja / 2, {
      baseline: 'middle',
    });
    this.fuente(pdf, 25, true, [255, 255, 255]);
    pdf.text(money(d.total), x + anchoCaja - px(20), y + altoCaja / 2, {
      align: 'right',
      baseline: 'middle',
    });

    return y + altoCaja;
  }

  private pie(pdf: jsPDF, d: PresupuestoPdfDatos, y0: number) {
    const condiciones =
      d.condicionesTexto?.trim() ||
      [
        d.senaSugeridaPct
          ? `Seña del ${d.senaSugeridaPct}% para iniciar el trabajo, saldo contra entrega.`
          : null,
        d.fechaValidez
          ? `Este presupuesto es válido hasta el ${fecha(d.fechaValidez)}; pasada esa fecha los precios pueden actualizarse.`
          : null,
      ]
        .filter(Boolean)
        .join(' ');

    let y = y0 + px(28);
    this.fuente(pdf, 13);
    const xTexto = MARGEN + px(18) + px(19) + px(13);
    const util = CONTENIDO - (xTexto - MARGEN) - px(18);
    const lineas = condiciones
      ? (pdf.splitTextToSize(condiciones, util) as string[])
      : [];

    if (lineas.length > 0) {
      const altoCaja = px(16) * 2 + lineas.length * px(19.5);
      if (y + altoCaja > ALTO - px(60)) y = this.nuevaPagina(pdf);

      pdf.setFillColor(...ACCENT_BG);
      pdf.setDrawColor(...ACCENT_BORD);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(MARGEN, y, CONTENIDO, altoCaja, px(14), px(14), 'FD');

      // Ícono de reloj del diseño, simplificado a círculo con agujas.
      const cx = MARGEN + px(18) + px(9.5);
      const cy = y + px(16) + px(9);
      pdf.setDrawColor(...ACCENT);
      pdf.setLineWidth(0.35);
      pdf.circle(cx, cy, px(9), 'S');
      pdf.lines([[0, -px(5)]], cx, cy);
      pdf.lines([[px(3.5), 0]], cx, cy);

      this.fuente(pdf, 13, false, INK_2);
      lineas.forEach((l, i) => {
        pdf.text(l, xTexto, y + px(16) + px(13) + i * px(19.5));
      });
      y += altoCaja;
    }

    // Firma
    y += px(22);
    pdf.setDrawColor(...HAIRLINE);
    pdf.setLineWidth(0.2);
    pdf.line(MARGEN, y, ANCHO - MARGEN, y);
    y += px(18);
    this.fuente(pdf, 11.5, false, MUTED_2);
    pdf.text(`Gracias por confiar en ${d.negocio}.`, MARGEN, y + px(6));

    const marca = 'Generado con Grafoprint';
    const anchoMarca = pdf.getTextWidth(marca);
    const der = ANCHO - MARGEN;
    pdf.text(marca, der, y + px(6), { align: 'right' });
    const lado = px(16);
    pdf.setFillColor(...INK);
    pdf.roundedRect(
      der - anchoMarca - px(7) - lado,
      y + px(6) - lado / 2 - px(2),
      lado,
      lado,
      px(5),
      px(5),
      'F',
    );
    this.fuente(pdf, 9, true, [255, 255, 255]);
    pdf.text('G', der - anchoMarca - px(7) - lado / 2, y + px(6) - px(2), {
      align: 'center',
      baseline: 'middle',
    });
  }
}
