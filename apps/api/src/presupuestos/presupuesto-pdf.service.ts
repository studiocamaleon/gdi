import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsPDF } from 'jspdf';
import {
  formatearMonedaDoc,
  monedaDe,
  type Moneda,
} from '../common/moneda';

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
   * Contacto del negocio (Configuración › Empresa). Lo que no esté cargado se
   * omite, y si no hay nada la cabecera cae al subtítulo de siempre.
   */
  empresa?: {
    telefono?: string | null;
    email?: string | null;
    sitioWebLegible?: string | null;
    domicilio?: string | null;
    /** La moneda del tenant. Un PDF cruza fronteras: nunca `$` a secas. */
    moneda?: Moneda;
  } | null;
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
  private moneda: Moneda = monedaDe(null);

  /** "AR$ 1.234,56" / "CLP $ 1.235": en papel el símbolo va desambiguado. */
  private money(n: number): string {
    return formatearMonedaDoc(n, this.moneda);
  }

  generar(d: PresupuestoPdfDatos): Promise<Buffer> {
    this.moneda = d.empresa?.moneda ?? monedaDe(null);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    this.registrarFuente(pdf);
    this.fondo(pdf);

    let y = this.cabecera(pdf, d);
    y = this.meta(pdf, d, y);
    y = this.detalle(pdf, d, y);
    y = this.totales(pdf, d, y);
    this.pie(pdf, d, y);
    this.numerarPaginas(pdf, d);

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
   * En las hojas de continuación, arriba a la derecha: de qué presupuesto es y
   * en qué página va. Sólo tienen la tabla, así que sin esto una hoja suelta no
   * se puede identificar ni ordenar. En un presupuesto de una sola hoja no
   * aporta nada y no se dibuja.
   */
  private numerarPaginas(pdf: jsPDF, d: PresupuestoPdfDatos) {
    const total = pdf.getNumberOfPages();
    if (total < 2) return;

    for (let n = 2; n <= total; n++) {
      pdf.setPage(n);
      this.fuente(pdf, 10.5, false, MUTED_2);
      pdf.text(
        `${d.numero} · Página ${n} de ${total}`,
        ANCHO - MARGEN,
        px(30),
        {
          align: 'right',
        },
      );
    }
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

    // Debajo del nombre va el CONTACTO, no un subtítulo: "Presupuesto
    // comercial" repetía lo que la columna derecha ya dice en mayúsculas, y
    // el cliente que quiere llamar no tenía dónde mirar. Sin datos cargados
    // vuelve el subtítulo, para que la cabecera no quede coja.
    this.fuente(pdf, 22, true);
    const anchoNumero = pdf.getTextWidth(d.numero);
    this.fuente(pdf, 11.5, false, MUTED);
    const contacto = this.lineasContacto(
      pdf,
      d,
      ANCHO - MARGEN - anchoNumero - px(18) - xTexto,
    );
    if (contacto.length === 0) {
      this.fuente(pdf, 12.5, false, MUTED);
      pdf.text('Presupuesto comercial', xTexto, y + px(21) + px(17));
    } else {
      contacto.forEach((l, i) =>
        pdf.text(l, xTexto, y + px(21) + px(16) + i * px(14)),
      );
    }

    // ── Columna derecha: rótulo, número y pastilla de validez
    const der = ANCHO - MARGEN;
    this.fuente(pdf, 10.5, true, MUTED_2);
    pdf.text(this.espaciado('PRESUPUESTO'), der, y + px(9), {
      align: 'right',
    });
    this.fuente(pdf, 22, true);
    pdf.text(d.numero, der, y + px(31), { align: 'right' });

    // La validez NO va acá: vive en la banda de metadatos, junto a la fecha de
    // emisión, que es donde el lector la busca. Estaba en los dos lados y
    // repetir un dato en un documento comercial hace dudar de cuál vale.
    return y + lado + px(26);
  }

  /**
   * Hasta dos renglones de contacto: dónde queda y cómo se lo ubica.
   *
   * Dos y no uno porque una dirección completa más el teléfono más la web no
   * entran en el ancho que deja la columna del número.
   *
   * Y se MIDE, en vez de confiar: jsPDF no corta ni avisa, así que un negocio
   * con dominio y mail largos se escribiría por encima del número del
   * presupuesto. Cuando no entra se van cayendo los datos por el final —el
   * mail primero, que es el que menos se usa desde un papel— hasta que entre.
   */
  private lineasContacto(
    pdf: jsPDF,
    d: PresupuestoPdfDatos,
    disponible: number,
  ): string[] {
    const e = d.empresa;
    if (!e) return [];

    const partes = [e.telefono, e.sitioWebLegible, e.email]
      .map((x) => x?.trim())
      .filter(Boolean) as string[];

    let contacto = '';
    for (let corte = partes.length; corte > 0; corte--) {
      contacto = partes.slice(0, corte).join('  ·  ');
      if (pdf.getTextWidth(contacto) <= disponible) break;
      contacto = '';
    }

    const domicilio = e.domicilio?.trim() ?? '';
    return [
      pdf.getTextWidth(domicilio) <= disponible ? domicilio : '',
      contacto,
    ].filter(Boolean);
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

  // ── Detalle: una TABLA, no tarjetas ─────────────────────────────────
  //
  // El detalle era una tarjeta por item con el número en un círculo y cada
  // spec en su pastilla. Se leía como una pantalla de app, no como un
  // documento comercial: para comparar dos renglones había que barrer
  // pastillas en vez de bajar por una columna. Ahora es una tabla —cantidad,
  // unitario y total alineados a la derecha— y las specs son una línea de
  // texto discreta bajo el nombre. Lo moderno queda en la tipografía y el
  // aire, no en los adornos.

  /** Anchos de las columnas numéricas; la descripción se queda con el resto.
   *  Los fijos son MÍNIMOS de diseño: `calcularColumnas` los ensancha cuando
   *  alguna cifra real no entra (un total de seis cifras en bold desbordaba
   *  su columna y se pegaba al unitario). */
  private colsDoc: {
    orden: number;
    cant: number;
    unit: number;
    total: number;
  } | null = null;

  private get colNum(): {
    orden: number;
    cant: number;
    unit: number;
    total: number;
  } {
    return (
      this.colsDoc ?? { orden: px(22), cant: px(66), unit: px(96), total: px(104) }
    );
  }

  /** Mide cantidad/unitario/total de TODOS los renglones (y los rótulos) con
   *  sus fuentes reales y fija los anchos de columna del documento: el máximo
   *  contenido + aire. La descripción absorbe la diferencia. */
  private calcularColumnas(
    pdf: jsPDF,
    items: PresupuestoPdfDatos['items'],
  ): void {
    const AIRE = px(16);
    let wCant = 0;
    let wUnit = 0;
    let wTotal = 0;
    this.fuente(pdf, 10, true);
    const hCant = pdf.getTextWidth(this.espaciado('CANT.'));
    const hUnit = pdf.getTextWidth(this.espaciado('UNITARIO'));
    const hTotal = pdf.getTextWidth(this.espaciado('TOTAL'));
    for (const item of items) {
      const unitario =
        item.cantidad > 0 ? item.total / item.cantidad : item.total;
      this.fuente(pdf, 12.5, false);
      wCant = Math.max(
        wCant,
        pdf.getTextWidth(
          `${item.cantidad.toLocaleString('es-AR')} ${item.cantidadUnidad}`.trim(),
        ),
      );
      wUnit = Math.max(wUnit, pdf.getTextWidth(this.money(unitario)));
      this.fuente(pdf, 13, true);
      wTotal = Math.max(wTotal, pdf.getTextWidth(this.money(item.total)));
    }
    this.colsDoc = {
      orden: px(22),
      cant: Math.max(px(66), Math.max(wCant, hCant) + AIRE),
      unit: Math.max(px(96), Math.max(wUnit, hUnit) + AIRE),
      total: Math.max(px(104), Math.max(wTotal, hTotal) + AIRE),
    };
  }

  private get xColumnas(): {
    orden: number;
    desc: number;
    cant: number;
    unit: number;
    total: number;
    anchoDesc: number;
  } {
    const c = this.colNum;
    const orden = MARGEN;
    const desc = orden + c.orden;
    const total = ANCHO - MARGEN;
    const unit = total - c.total;
    const cant = unit - c.unit;
    return {
      orden,
      desc,
      cant,
      unit,
      total,
      anchoDesc: cant - c.cant - desc - px(10),
    };
  }

  /** "45 x 31 cm · Papel ilustración 250 g/m² · Simple faz" */
  private lineaSpecs(item: PresupuestoPdfDatos['items'][number]): string {
    return item.specs.map((s) => s.valor).join('  ·  ');
  }

  private detalle(pdf: jsPDF, d: PresupuestoPdfDatos, y0: number): number {
    this.calcularColumnas(pdf, d.items);
    let y = this.encabezadoTabla(pdf, y0);

    d.items.forEach((item, i) => {
      const alto = this.medirItem(pdf, item);
      // Un renglón no se parte entre páginas: media descripción arriba y el
      // precio abajo es peor que dejar un hueco. El margen inferior es el
      // mismo px(48) de arriba más el aire de la regla de cierre.
      if (y + alto > ALTO - px(60)) {
        y = this.nuevaPagina(pdf);
        y = this.encabezadoTabla(pdf, y);
      }
      this.filaItem(pdf, item, y, i + 1);
      y += alto;

      // Hairline entre renglones, no después del último: ahí cierra el borde
      // de la banda de totales.
      if (i < d.items.length - 1) {
        pdf.setDrawColor(...HAIRLINE);
        pdf.setLineWidth(0.2);
        pdf.line(MARGEN, y, ANCHO - MARGEN, y);
      }
    });

    // Regla de cierre, del mismo peso que la del encabezado: la tabla queda
    // contenida entre las dos y los totales se leen como su continuación, no
    // como un bloque suelto.
    pdf.setDrawColor(...BORDE);
    pdf.setLineWidth(0.35);
    pdf.line(MARGEN, y, ANCHO - MARGEN, y);

    return y;
  }

  /** Rótulos de columna + la regla que los separa del cuerpo. */
  private encabezadoTabla(pdf: jsPDF, y0: number): number {
    const x = this.xColumnas;
    const y = y0 + px(11);

    this.fuente(pdf, 10, true, MUTED_2);
    pdf.text(this.espaciado('#'), x.orden, y);
    pdf.text(this.espaciado('DESCRIPCIÓN'), x.desc, y);
    pdf.text(this.espaciado('CANT.'), x.cant, y, { align: 'right' });
    pdf.text(this.espaciado('UNITARIO'), x.unit, y, { align: 'right' });
    pdf.text(this.espaciado('TOTAL'), x.total, y, { align: 'right' });

    const yRegla = y + px(9);
    pdf.setDrawColor(...BORDE);
    pdf.setLineWidth(0.35);
    pdf.line(MARGEN, yRegla, ANCHO - MARGEN, yRegla);
    return yRegla;
  }

  /** Nombre partido con el ancho de la columna de descripción. */
  private lineasNombre(
    pdf: jsPDF,
    item: PresupuestoPdfDatos['items'][number],
  ): string[] {
    this.fuente(pdf, 14, true);
    return pdf.splitTextToSize(
      item.nombre,
      this.xColumnas.anchoDesc,
    ) as string[];
  }

  private lineasSpecs(
    pdf: jsPDF,
    item: PresupuestoPdfDatos['items'][number],
  ): string[] {
    const texto = this.lineaSpecs(item);
    if (!texto) return [];
    this.fuente(pdf, 11.5);
    return pdf.splitTextToSize(texto, this.xColumnas.anchoDesc) as string[];
  }

  private lineasAdicionales(
    pdf: jsPDF,
    item: PresupuestoPdfDatos['items'][number],
  ): string[] {
    if (item.adicionales.length === 0) return [];
    this.fuente(pdf, 11.5);
    return pdf.splitTextToSize(
      `Incluye: ${item.adicionales.join(', ')}`,
      this.xColumnas.anchoDesc,
    ) as string[];
  }

  /**
   * Alto del renglón. Tiene que coincidir EXACTO con lo que dibuja
   * `filaItem`: si midiera distinto, la paginación cortaría renglones.
   */
  private medirItem(
    pdf: jsPDF,
    item: PresupuestoPdfDatos['items'][number],
  ): number {
    const nombre = this.lineasNombre(pdf, item).length;
    const specs = this.lineasSpecs(pdf, item).length;
    const adic = this.lineasAdicionales(pdf, item).length;
    return (
      px(14) +
      nombre * px(19) +
      (specs > 0 ? px(4) + specs * px(15) : 0) +
      (adic > 0 ? px(3) + adic * px(15) : 0) +
      px(14)
    );
  }

  private filaItem(
    pdf: jsPDF,
    item: PresupuestoPdfDatos['items'][number],
    y0: number,
    orden: number,
  ) {
    const x = this.xColumnas;
    const y = y0 + px(14) + px(13);

    // El número de orden, gris y chico: ordena sin competir con el nombre.
    this.fuente(pdf, 11.5, false, MUTED_2);
    pdf.text(String(orden), x.orden, y);

    this.fuente(pdf, 14, true, INK);
    const nombre = this.lineasNombre(pdf, item);
    nombre.forEach((l, i) => pdf.text(l, x.desc, y + i * px(19)));
    let yTexto = y + (nombre.length - 1) * px(19);

    const specs = this.lineasSpecs(pdf, item);
    if (specs.length > 0) {
      this.fuente(pdf, 11.5, false, MUTED);
      yTexto += px(4) + px(15);
      specs.forEach((l, i) => pdf.text(l, x.desc, yTexto + i * px(15)));
      yTexto += (specs.length - 1) * px(15);
    }

    const adic = this.lineasAdicionales(pdf, item);
    if (adic.length > 0) {
      this.fuente(pdf, 11.5, false, VERDE);
      yTexto += px(3) + px(15);
      adic.forEach((l, i) => pdf.text(l, x.desc, yTexto + i * px(15)));
    }

    // Las cifras se alinean con la PRIMERA línea del nombre: leídas en
    // columna, tienen que estar a la misma altura aunque un item ocupe tres
    // renglones y el otro uno.
    const unitario =
      item.cantidad > 0 ? item.total / item.cantidad : item.total;
    this.fuente(pdf, 12.5, false, INK_2);
    pdf.text(
      `${item.cantidad.toLocaleString('es-AR')} ${item.cantidadUnidad}`.trim(),
      x.cant,
      y,
      { align: 'right' },
    );
    pdf.text(this.money(unitario), x.unit, y, { align: 'right' });
    this.fuente(pdf, 13, true, INK);
    pdf.text(this.money(item.total), x.total, y, { align: 'right' });
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
      pdf.text(this.money(v), x + anchoCaja - px(4), y + px(9) + px(6), {
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
    pdf.text(this.money(d.total), x + anchoCaja - px(20), y + altoCaja / 2, {
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
