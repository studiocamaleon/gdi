import { resolverRangoPaginas } from './rangos-paginas';

export type CopiasPaginaCad = { pagina: number; copias: number };
type DocumentoCopias = {
  modo?: 'HOJAS' | 'CAD';
  paginas: number;
  paginasOriginales?: number;
  rangoPaginas?: string;
  copias: number;
  /** Excepciones por número del PDF original. [] activa el desglose sin excepciones. */
  copiasPorPagina?: CopiasPaginaCad[];
};

export function errorCopiasPorPagina(doc: DocumentoCopias): string | null {
  if (doc.copiasPorPagina == null) return null;
  if (doc.modo !== 'CAD')
    return 'Las copias por página sólo se admiten en Planos CAD.';
  if (
    !Array.isArray(doc.copiasPorPagina) ||
    doc.copiasPorPagina.length > 100000
  )
    return 'Revisá el desglose de copias por página.';
  const vistas = new Set<number>();
  for (const p of doc.copiasPorPagina) {
    if (
      !p ||
      !Number.isSafeInteger(p.pagina) ||
      p.pagina < 1 ||
      p.pagina > (doc.paginasOriginales ?? doc.paginas) ||
      vistas.has(p.pagina)
    )
      return 'El desglose debe referir a páginas del PDF original sin repetirlas.';
    if (!Number.isSafeInteger(p.copias) || p.copias < 1 || p.copias > 10000)
      return 'Las copias de cada página deben ser un entero entre 1 y 10.000.';
    vistas.add(p.pagina);
  }
  return null;
}

export function mapaCopiasCad(doc: Pick<DocumentoCopias, 'copiasPorPagina'>) {
  return new Map((doc.copiasPorPagina ?? []).map((p) => [p.pagina, p.copias]));
}

/** Suma sólo la selección; conserva las excepciones fuera del rango para editarlo. */
export function cantidadImpresionesCad(doc: DocumentoCopias): number {
  const seleccion = resolverRangoPaginas(
    doc.rangoPaginas ?? '',
    doc.paginasOriginales ?? doc.paginas,
  );
  if (seleccion.error) return 0;
  const copias = mapaCopiasCad(doc);
  let cantidad = 0;
  for (const [desde, hasta] of seleccion.intervalos) {
    for (let pagina = desde; pagina <= hasta; pagina++)
      cantidad += copias.get(pagina) ?? doc.copias;
  }
  return cantidad;
}
