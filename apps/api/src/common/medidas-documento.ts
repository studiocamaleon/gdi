import { resolverRangoPaginas } from './rangos-paginas';

export type MedidaPagina = { anchoMm: number; altoMm: number };

export function errorMedidasDocumento(doc: {
  medidasPaginas?: MedidaPagina[];
  paginas: number;
  paginasOriginales?: number;
}) {
  if (doc.medidasPaginas == null) return null;
  if (
    !Array.isArray(doc.medidasPaginas) ||
    doc.medidasPaginas.length !== (doc.paginasOriginales ?? doc.paginas) ||
    doc.medidasPaginas.some(
      (p) =>
        !p ||
        ![p.anchoMm, p.altoMm].every(
          (n) => Number.isFinite(n) && n > 0 && n <= 100_000,
        ),
    )
  )
    return 'Las medidas deben corresponder a cada página del archivo original.';
  return null;
}

export function medidasSeleccionadas(
  medidas: readonly MedidaPagina[] | undefined,
  rango = '',
) {
  if (!medidas?.length) return [];
  const seleccion = resolverRangoPaginas(rango, medidas.length);
  if (seleccion.error) return [];
  return seleccion.intervalos.flatMap(([a, b]) =>
    medidas.slice(a - 1, b).map((m, i) => ({ ...m, pagina: a + i })),
  );
}

export function formatoMedida(m: MedidaPagina) {
  const corto = Math.min(m.anchoMm, m.altoMm);
  const largo = Math.max(m.anchoMm, m.altoMm);
  const formatos = [
    ['A0', 841, 1189],
    ['A1', 594, 841],
    ['A2', 420, 594],
    ['A3', 297, 420],
    ['A4', 210, 297],
    ['A5', 148, 210],
  ] as const;
  return (
    formatos.find(
      ([, a, b]) => Math.abs(corto - a) < 1 && Math.abs(largo - b) < 1,
    )?.[0] ?? `${numeroMedida(m.anchoMm)} × ${numeroMedida(m.altoMm)} mm`
  );
}

export const numeroMedida = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 1 });
export function resumenMedidas(medidas: readonly MedidaPagina[]) {
  if (!medidas.length) return 'Sin medidas';
  const primera = medidas[0];
  return medidas.every(
    (p) =>
      Math.abs(
        Math.min(p.anchoMm, p.altoMm) -
          Math.min(primera.anchoMm, primera.altoMm),
      ) < 0.1 &&
      Math.abs(
        Math.max(p.anchoMm, p.altoMm) -
          Math.max(primera.anchoMm, primera.altoMm),
      ) < 0.1,
  )
    ? formatoMedida(primera)
    : 'Tamaños mixtos';
}

export function sugerirCad(
  medidas: readonly MedidaPagina[],
  formatos: readonly MedidaPagina[],
) {
  return medidas.some(
    (p) =>
      !formatos.some(
        (f) =>
          (p.anchoMm <= f.anchoMm + 1 && p.altoMm <= f.altoMm + 1) ||
          (p.altoMm <= f.anchoMm + 1 && p.anchoMm <= f.altoMm + 1),
      ),
  );
}
