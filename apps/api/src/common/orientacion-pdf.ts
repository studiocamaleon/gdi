import { resolverRangoPaginas } from './rangos-paginas';

export const ORIENTACIONES_PAGINA = ['vertical', 'horizontal'] as const;
export type OrientacionPagina = (typeof ORIENTACIONES_PAGINA)[number];
export type OrientacionDocumento = OrientacionPagina | 'mixto';

/** Contrato estructural de PDFPage; compartido sin cargar pdf-lib en el cliente. */
type PaginaPdf = {
  getMediaBox(): { x: number; y: number; width: number; height: number };
  getCropBox(): { x: number; y: number; width: number; height: number };
  getRotation(): { angle: number };
};

export function orientacionPaginaPdf(pagina: PaginaPdf): OrientacionPagina {
  const media = pagina.getMediaBox();
  const crop = pagina.getCropBox();
  // El área visible es la intersección del recorte y la hoja original.
  const ancho =
    Math.min(media.x + media.width, crop.x + crop.width) -
    Math.max(media.x, crop.x);
  const alto =
    Math.min(media.y + media.height, crop.y + crop.height) -
    Math.max(media.y, crop.y);
  const rotacion = ((pagina.getRotation().angle % 360) + 360) % 360;
  const girada = rotacion === 90 || rotacion === 270;
  return (girada ? alto > ancho : ancho > alto) ? 'horizontal' : 'vertical';
}

/** La posición en el array corresponde a la página del original, antes del rango. */
export function orientacionesSeleccionadas(
  orientaciones: readonly OrientacionPagina[] | undefined,
  rango = '',
): OrientacionPagina[] {
  if (!orientaciones?.length) return [];
  const seleccion = resolverRangoPaginas(rango, orientaciones.length);
  if (seleccion.error) return [];
  return seleccion.intervalos.flatMap(([desde, hasta]) =>
    orientaciones.slice(desde - 1, hasta),
  );
}

export function resumirOrientaciones(
  orientaciones: readonly OrientacionPagina[],
): OrientacionDocumento | null {
  if (!orientaciones.length) return null;
  return orientaciones.every((o) => o === orientaciones[0])
    ? orientaciones[0]
    : 'mixto';
}

export function errorOrientacionesDocumento(doc: {
  orientacionesPaginas?: unknown;
  paginas: number;
  paginasOriginales?: number;
}): string | null {
  const lista = doc.orientacionesPaginas;
  // Los documentos históricos y las filas manuales no tienen esta lectura.
  if (lista == null) return null;
  if (
    !Array.isArray(lista) ||
    !lista.length ||
    lista.length > 100_000 ||
    lista.length !== (doc.paginasOriginales ?? doc.paginas) ||
    lista.some((o) => !ORIENTACIONES_PAGINA.includes(o))
  )
    return 'La orientación debe corresponder a cada página del archivo original.';
  return null;
}
