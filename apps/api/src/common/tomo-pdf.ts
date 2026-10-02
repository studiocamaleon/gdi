import { PDFDocument, type PDFPage } from 'pdf-lib';
import { resolverRangoPaginas } from './rangos-paginas';

export const MAX_BYTES_TOMO = 100 * 1024 * 1024;
export const MAX_PAGINAS_TOMO = 5000;

export type FuenteTomoPdf = {
  nombre: string;
  paginas: number;
  paginasOriginales?: number;
  rangoPaginas?: string;
  faz: 1 | 2;
  cargar: () => Promise<Uint8Array>;
};

/** Compartido con impresión directa: conserva CropBox, rotación y tamaño.
 * También cierra el último original impar: el siguiente juego empieza en frente.
 */
export async function agregarPaginasTomo(
  destino: PDFDocument,
  original: PDFDocument,
  indices: number[],
  completarDorso: boolean,
): Promise<number> {
  const paginas = await destino.copyPages(original, indices);
  paginas.forEach((pagina) => destino.addPage(pagina));
  if (!completarDorso || indices.length % 2 === 0) return 0;
  const ultima: PDFPage = paginas[paginas.length - 1];
  const { width, height } = ultima.getSize();
  const blanco = destino.addPage([width, height]);
  const crop = ultima.getCropBox();
  blanco.setCropBox(crop.x, crop.y, crop.width, crop.height);
  blanco.setRotation(ultima.getRotation());
  return 1;
}

/** Un juego, sin multiplicar copias ni alterar los originales. */
export async function unificarTomoPdf(fuentes: FuenteTomoPdf[]) {
  if (!fuentes.length) throw new Error('Agregá los PDF del tomo.');
  if (fuentes.some((f) => f.faz !== fuentes[0].faz))
    throw new Error(
      'Para unir el PDF, todos los documentos deben usar la misma cantidad de caras. Separá la impresión simple y doble faz.',
    );
  if (
    fuentes.some(
      (f) =>
        !Number.isSafeInteger(f.paginas) ||
        f.paginas < 1 ||
        ![1, 2].includes(f.faz),
    )
  )
    throw new Error('Revisá las páginas y las caras de los documentos.');
  const totalPrevisto = fuentes.reduce(
    (n, f) => n + f.paginas + (f.faz === 2 ? f.paginas % 2 : 0),
    0,
  );
  if (totalPrevisto > MAX_PAGINAS_TOMO)
    throw new Error(
      'El tomo supera las 5.000 páginas. Dividilo en tomos más pequeños.',
    );
  const unido = await PDFDocument.create();
  let totalBytes = 0,
    blancos = 0;
  for (const fuente of fuentes) {
    const bytes = await fuente.cargar();
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_BYTES_TOMO)
      throw new Error(
        'Los originales superan los 100 MB. Dividilos en tomos más pequeños.',
      );
    let original: PDFDocument;
    try {
      original = await PDFDocument.load(bytes, { updateMetadata: false });
      // Las apariencias existentes se incorporan a cada página; no se pierden
      // campos rellenados al copiar páginas de documentos diferentes.
      original.getForm().flatten({ updateFieldAppearances: false });
    } catch {
      throw new Error(
        `No se pudo unir «${fuente.nombre}». Usá un PDF válido y sin contraseña.`,
      );
    }
    if (
      original.getPageCount() !== (fuente.paginasOriginales ?? fuente.paginas)
    )
      throw new Error(
        `Las páginas de «${fuente.nombre}» cambiaron. Volvé a cargarlo y cotizarlo.`,
      );
    const seleccion = resolverRangoPaginas(
      fuente.rangoPaginas ?? '',
      original.getPageCount(),
    );
    if (seleccion.error || seleccion.paginas !== fuente.paginas)
      throw new Error(
        `Revisá el rango de «${fuente.nombre}»: no coincide con la cotización.`,
      );
    const indices = seleccion.intervalos.flatMap(([desde, hasta]) =>
      Array.from({ length: hasta - desde + 1 }, (_, i) => desde - 1 + i),
    );
    blancos += await agregarPaginasTomo(
      unido,
      original,
      indices,
      fuente.faz === 2,
    );
  }
  return { bytes: await unido.save(), paginas: unido.getPageCount(), blancos };
}
