/** Páginas numeradas desde 1, en orden del original y sin duplicados. */
export type SeleccionPaginas = {
  paginas: number;
  rango: string;
  intervalos: Array<[number, number]>;
  error: string | null;
};

export function resolverRangoPaginas(
  texto: string,
  total: number,
): SeleccionPaginas {
  const fallo = (error: string): SeleccionPaginas => ({
    paginas: 0,
    rango: texto,
    intervalos: [],
    error,
  });
  if (!Number.isSafeInteger(total) || total < 1 || total > 100_000)
    return fallo(
      'Indicá la cantidad de páginas del archivo (entre 1 y 100.000).',
    );
  if (!texto.trim())
    return { paginas: total, rango: '', intervalos: [[1, total]], error: null };
  if (texto.length > 2000)
    return fallo('El rango es demasiado largo. Usá intervalos como 1-7.');
  const intervalos: Array<[number, number]> = [];
  for (const parte of texto.split(',')) {
    const m = parte.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m)
      return fallo(
        'Usá páginas o rangos separados por comas. Ej.: 1-7,9,12-16.',
      );
    const desde = Number(m[1]);
    const hasta = Number(m[2] ?? m[1]);
    if (desde < 1 || hasta < 1) return fallo('Las páginas se numeran desde 1.');
    if (desde > hasta)
      return fallo(`El rango ${desde}-${hasta} está invertido.`);
    if (hasta > total)
      return fallo(
        `El archivo tiene ${total} páginas. Revisá el rango ${parte.trim()}.`,
      );
    intervalos.push([desde, hasta]);
  }
  intervalos.sort((a, b) => a[0] - b[0]);
  const unidos: Array<[number, number]> = [];
  for (const intervalo of intervalos) {
    const anterior = unidos.at(-1);
    if (anterior && intervalo[0] <= anterior[1] + 1)
      anterior[1] = Math.max(anterior[1], intervalo[1]);
    else unidos.push([...intervalo]);
  }
  return {
    paginas: unidos.reduce((n, [a, b]) => n + b - a + 1, 0),
    rango: unidos
      .map(([a, b]) => (a === b ? String(a) : `${a}-${b}`))
      .join(','),
    intervalos: unidos,
    error: null,
  };
}

export type PaginasDocumento = {
  paginas: number;
  paginasOriginales?: number;
  rangoPaginas?: string;
  archivoNombre?: string;
};

/** Valida también los snapshots históricos: sin rango, se imprime el original. */
export function errorPaginasDocumento(doc: PaginasDocumento): string | null {
  if (
    doc.rangoPaginas?.trim() &&
    (!doc.archivoNombre || doc.paginasOriginales == null)
  )
    return 'El rango necesita un archivo asociado y su cantidad original de páginas.';
  const seleccion = resolverRangoPaginas(
    doc.rangoPaginas ?? '',
    doc.paginasOriginales ?? doc.paginas,
  );
  if (seleccion.error) return seleccion.error;
  if (seleccion.paginas !== doc.paginas)
    return 'La cantidad de páginas no coincide con el rango seleccionado.';
  return null;
}

export function metadataRangoPaginas(doc: PaginasDocumento) {
  return {
    ...(doc.paginasOriginales != null
      ? { paginasOriginales: doc.paginasOriginales }
      : {}),
    ...(doc.rangoPaginas?.trim()
      ? {
          rangoPaginas: resolverRangoPaginas(
            doc.rangoPaginas,
            doc.paginasOriginales ?? doc.paginas,
          ).rango,
        }
      : {}),
  };
}
