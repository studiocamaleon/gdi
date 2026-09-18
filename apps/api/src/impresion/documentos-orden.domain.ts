/** Contrato de impresión derivado exclusivamente del snapshot cotizado. */
import {
  planDocumentoCad,
  type PaginaCadImprimible,
} from './documento-cad.domain';
import { errorPaginasDocumento } from '../common/rangos-paginas';
import type { ConfiguracionDocumento } from './perfiles-impresion.domain';
import {
  errorOrientacionesDocumento,
  orientacionesSeleccionadas,
  resumirOrientaciones,
  type OrientacionPagina,
  type OrientacionDocumento,
} from '../common/orientacion-pdf';

export type SegmentoImprimible = {
  nombre: string;
  paginas: number;
  paginasOriginales?: number;
  rangoPaginas?: string;
  orientacionesPaginas?: OrientacionPagina[];
  faz: 1 | 2;
};
export type PlanDocumento = {
  paginasCad?: PaginaCadImprimible[];
  configuracion: ConfiguracionDocumento;
  nombre: string;
  copias: number;
  paginas: number;
  hojas: number;
  faz: 1 | 2;
  segmentos: SegmentoImprimible[];
  orientacion: OrientacionDocumento | null;
  motivo: string | null;
};
export function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}
function texto(valor: unknown, fallback: string): string {
  return typeof valor === 'string' && valor.length ? valor : fallback;
}
export function planDocumento(job: unknown): PlanDocumento | null {
  const meta = objeto(objeto(job)._centroCopiado);
  if (!Object.keys(meta).length) return null;
  if (meta.modo === 'CAD') return planDocumentoCad(meta);
  const segmentos = meta.esTomo
    ? Array.isArray(meta.segmentos)
      ? meta.segmentos.map(objeto)
      : []
    : [meta];
  const copias = Number(meta.esTomo ? meta.juegos : meta.copias);
  const faz = segmentos[0]?.faz === 2 ? 2 : 1;
  let motivo: string | null = null;
  if (
    !segmentos.length ||
    segmentos.some(
      (s) => s.tamano !== 'A4' || !['BN', 'COLOR'].includes(String(s.color)),
    )
  )
    motivo =
      'La impresión directa admite documentos en A4, en blanco y negro o color.';
  else if (
    segmentos.some(
      (s) =>
        s.faz !== faz ||
        s.color !== segmentos[0].color ||
        s.papelMateriaPrimaId !== segmentos[0].papelMateriaPrimaId ||
        s.gramaje !== segmentos[0].gramaje,
    )
  )
    motivo =
      'El tomo combina papeles, color o caras diferentes; requiere impresión manual.';
  else if (
    !Number.isSafeInteger(copias) ||
    copias < 1 ||
    copias > 999 ||
    segmentos.some(
      (s) =>
        !Number.isSafeInteger(s.paginas) ||
        Number(s.paginas) < 1 ||
        Number(s.paginas) > 2000 ||
        ![1, 2].includes(Number(s.faz)),
    )
  )
    motivo =
      'Revisá las páginas y copias cotizadas (máximo 2.000 páginas por PDF y 999 copias).';
  for (const s of segmentos) {
    if (motivo) break;
    if (s.rangoPaginas != null && typeof s.rangoPaginas !== 'string') {
      motivo =
        'El rango de páginas guardado es inválido. Volvé a cotizar el documento.';
      break;
    }
    const paginas = {
      paginas: Number(s.paginas),
      paginasOriginales:
        s.paginasOriginales == null ? undefined : Number(s.paginasOriginales),
      rangoPaginas:
        typeof s.rangoPaginas === 'string' ? s.rangoPaginas : undefined,
      archivoNombre:
        typeof s.archivoNombre === 'string' ? s.archivoNombre : undefined,
    };
    motivo =
      errorPaginasDocumento(paginas) ||
      errorOrientacionesDocumento({
        ...paginas,
        orientacionesPaginas: s.orientacionesPaginas,
      });
  }
  const paginas = segmentos.reduce((n, s) => n + Number(s.paginas || 0), 0);
  const hojas =
    segmentos.reduce((n, s) => n + Math.ceil(Number(s.paginas || 0) / faz), 0) *
    copias;
  // Cotizaciones históricas podían compartir el dorso entre copias impares.
  // No imprimir una cantidad de hojas distinta a la guardada sin recotizar.
  if (!motivo && Number(meta.hojas) !== hojas)
    motivo =
      'Las hojas guardadas no coinciden con copias completas. Volvé a cotizar este documento.';
  return {
    configuracion: {
      papelMateriaPrimaId: texto(segmentos[0]?.papelMateriaPrimaId, ''),
      papelNombre: texto(meta.papelLabel, ''),
      gramaje:
        segmentos[0]?.gramaje == null ? null : Number(segmentos[0].gramaje),
      tamano: texto(segmentos[0]?.tamano, ''),
      color: texto(segmentos[0]?.color, ''),
      faz,
    },
    nombre: meta.esTomo
      ? texto(meta.tomoNombre, 'Tomo')
      : texto(meta.nombre, 'Documento'),
    copias,
    paginas,
    hojas,
    faz,
    motivo,
    orientacion:
      !motivo && segmentos.every((s) => Array.isArray(s.orientacionesPaginas))
        ? resumirOrientaciones(
            segmentos.flatMap((s) =>
              orientacionesSeleccionadas(
                s.orientacionesPaginas as OrientacionPagina[],
                typeof s.rangoPaginas === 'string' ? s.rangoPaginas : '',
              ),
            ),
          )
        : null,
    segmentos: segmentos.map((s) => ({
      nombre: texto(s.archivoNombre, texto(s.nombre, '')),
      paginas: Number(s.paginas),
      ...(s.paginasOriginales != null
        ? { paginasOriginales: Number(s.paginasOriginales) }
        : {}),
      ...(typeof s.rangoPaginas === 'string'
        ? { rangoPaginas: s.rangoPaginas }
        : {}),
      faz,
      ...(Array.isArray(s.orientacionesPaginas)
        ? {
            orientacionesPaginas: s.orientacionesPaginas as OrientacionPagina[],
          }
        : {}),
    })),
  };
}

export const ESTADOS_IMPRESION = [
  'PREPARADO',
  'ENVIADO',
  'SPOOLING',
  'SCHEDULED',
  'PRINTING',
  'SENT',
  'COMPLETE',
  'PRINTED',
  'DELETED',
  'CANCELED',
  'ABORTED',
  'ERROR',
  'PAUSED',
  'SIN_CONFIRMAR',
] as const;
export type EstadoImpresion = (typeof ESTADOS_IMPRESION)[number];
/** Los eventos tardíos de envío/borrado no borran una finalización informada. */
export function siguienteEstado(
  actual: EstadoImpresion,
  nuevo: EstadoImpresion,
): EstadoImpresion {
  if (['COMPLETE', 'PRINTED', 'CANCELED', 'ABORTED'].includes(actual))
    return actual;
  if (nuevo === 'PREPARADO') return actual;
  if (
    ['ENVIADO', 'SIN_CONFIRMAR'].includes(nuevo) &&
    !['PREPARADO', 'SIN_CONFIRMAR'].includes(actual)
  )
    return actual;
  if (
    actual === 'PRINTING' &&
    ['SPOOLING', 'SCHEDULED', 'SENT'].includes(nuevo)
  )
    return actual;
  return nuevo;
}
