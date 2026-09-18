import sharp from 'sharp';
import QRCode from 'qrcode';

export type DatosEtiqueta = {
  numero: string;
  empresa: string;
  cliente: string;
  fechaEntrega: Date | null;
  logo: string | null;
  productos: Array<{ nombre: string; cantidad: number; unidad: string }>;
};
export const ANCHO_ETIQUETA = 800;
export const ALTO_ETIQUETA = 1200;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

/** Corta por palabras; limita los rótulos, nunca la cantidad ni el código QR. */
export function lineas(texto: string, ancho: number, maximo: number): string[] {
  const palabras = texto.replace(/\s+/g, ' ').trim().split(' ');
  const resultado: string[] = [];
  let actual = '';
  for (const palabra of palabras) {
    for (let i = 0; i < palabra.length; i += ancho) {
      const parte = palabra.slice(i, i + ancho);
      if (actual && actual.length + parte.length + 1 > ancho) {
        resultado.push(actual);
        actual = '';
      }
      actual += `${actual ? ' ' : ''}${parte}`;
    }
  }
  if (actual) resultado.push(actual);
  if (resultado.length > maximo) {
    resultado.length = maximo;
    resultado[maximo - 1] = `${resultado[maximo - 1].slice(0, ancho - 1)}…`;
  }
  return resultado.length ? resultado : ['—'];
}

// Margen conservador para rótulos anchos: evita que nombres o cantidades
// invadan la otra columna incluso con mayúsculas y unidades extensas.
function ajuste(valor: string, tam: number, ancho: number) {
  const estimado =
    [...valor].reduce(
      (suma, c) =>
        suma +
        (/[MW@]/.test(c)
          ? 1
          : /[ilI.,:;! ']/.test(c)
            ? 0.35
            : c.charCodeAt(0) > 0x2fff
              ? 1
              : 0.68),
      0,
    ) * tam;
  return estimado > ancho
    ? ` textLength="${ancho}" lengthAdjust="spacingAndGlyphs"`
    : '';
}
function texto(
  x: number,
  y: number,
  valor: string,
  tam = 26,
  peso = 400,
  ancho = 716,
) {
  return `<text x="${x}" y="${y}" font-size="${tam}" font-weight="${peso}"${ajuste(valor, tam, ancho)}>${esc(valor)}</text>`;
}

/** Ocho puntos por mm: raster pequeño y determinista, sin navegador ni PDF. */
export async function renderizarEtiquetas(
  datos: DatosEtiqueta,
  soloPagina?: number,
): Promise<Buffer[]> {
  let logo = '';
  if (datos.logo) {
    try {
      const bytes = Buffer.from(datos.logo.split(',')[1], 'base64');
      const png = await sharp(bytes, { limitInputPixels: 16_000_000 })
        .resize(100, 80, { fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#fff' })
        .png()
        .toBuffer();
      logo = `<image x="42" y="32" width="100" height="80" href="data:image/png;base64,${png.toString('base64')}"/>`;
    } catch {
      /* El nombre de la empresa sigue identificando la etiqueta. */
    }
  }
  const qr = QRCode.create(datos.numero, { errorCorrectionLevel: 'H' });
  const celda = Math.min(8, Math.floor(264 / (qr.modules.size + 8)));
  const anchoQr = (qr.modules.size + 8) * celda;
  const xQr = Math.floor((ANCHO_ETIQUETA - anchoQr) / 2) + 4 * celda;
  const yQr = 852 + 4 * celda;
  let cuadros = '';
  for (let y = 0; y < qr.modules.size; y++) {
    for (let x = 0; x < qr.modules.size; x++) {
      if (qr.modules.get(y, x))
        cuadros += `<rect x="${xQr + x * celda}" y="${yQr + y * celda}" width="${celda}" height="${celda}"/>`;
    }
  }
  const fecha = datos.fechaEntrega
    ? new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(datos.fechaEntrega)
    : 'Sin fecha comprometida';
  const porPagina = 5;
  const paginas = Math.max(1, Math.ceil(datos.productos.length / porPagina));
  const salida: Buffer[] = [];
  for (
    let pagina = soloPagina ?? 0;
    pagina < (soloPagina === undefined ? paginas : soloPagina + 1);
    pagina++
  ) {
    let cuerpo = `${logo}${lineas(datos.empresa, logo ? 28 : 35, 2)
      .map((l, i) => texto(logo ? 164 : 42, 64 + i * 34, l, 28, 700))
      .join('')}`;
    cuerpo += '<path d="M42 128H758" stroke="black" stroke-width="3"/>';
    cuerpo += texto(42, 170, 'ORDEN DE TRABAJO · IDENTIFICACIÓN INTERNA', 19);
    cuerpo += texto(42, 233, datos.numero, 48, 700);
    cuerpo += lineas(datos.cliente, 38, 2)
      .map((l, i) => texto(42, 282 + i * 36, l, 30, 700))
      .join('');
    cuerpo += texto(42, 366, `ENTREGA · ${fecha}`, 24);
    cuerpo += '<path d="M42 394H758" stroke="black" stroke-width="2"/>';
    cuerpo += texto(42, 430, 'PRODUCTOS', 20, 700);
    datos.productos
      .slice(pagina * porPagina, (pagina + 1) * porPagina)
      .forEach((p, i) => {
        const y = 471 + i * 72;
        cuerpo += lineas(p.nombre, 36, 2)
          .map((l, j) => texto(42, y + j * 28, l, 24, 400, 480))
          .join('');
        cuerpo += `<text x="758" y="${y}" text-anchor="end" font-size="23" font-weight="700"${ajuste(`${numero.format(p.cantidad)} ${p.unidad}`, 23, 210)}>${esc(`${numero.format(p.cantidad)} ${p.unidad}`)}</text>`;
      });
    cuerpo += '<path d="M42 831H758" stroke="black" stroke-width="2"/>';
    cuerpo += cuadros;
    cuerpo += texto(42, 1140, 'Escaneá en Grafo para abrir la entrega', 23);
    cuerpo += `<text x="758" y="1180" text-anchor="end" font-size="18">${pagina + 1} / ${paginas}</text>`;
    cuerpo += texto(42, 1180, 'grafo.', 20, 700);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="white"/><g fill="black" font-family="Arial, sans-serif">${cuerpo}</g></svg>`;
    salida.push(
      await sharp(Buffer.from(svg))
        .flatten({ background: '#fff' })
        .greyscale()
        .threshold(180)
        .png()
        .toBuffer(),
    );
  }
  return salida;
}

/** TSPL BITMAP, modo overwrite. Un bit a 0 representa un punto negro (manual TSPL, BITMAP). */
export async function etiquetaTspl(
  png: Buffer,
  copias: number,
): Promise<Buffer> {
  const { data, info } = await sharp(png)
    .greyscale()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== ANCHO_ETIQUETA || info.height !== ALTO_ETIQUETA)
    throw new Error('Tamaño de etiqueta inválido');
  const raster = Buffer.alloc((ANCHO_ETIQUETA * ALTO_ETIQUETA) / 8);
  for (let i = 0; i < data.length; i++) {
    if (data[i] >= 128) raster[i >> 3] |= 0x80 >> (i & 7);
  }
  return Buffer.concat([
    Buffer.from(
      'SIZE 100 mm,150 mm\r\nDIRECTION 1\r\nREFERENCE 0,0\r\nCLS\r\nBITMAP 0,0,100,1200,0,',
      'ascii',
    ),
    raster,
    Buffer.from(`\r\nPRINT 1,${copias}\r\n`, 'ascii'),
  ]);
}
