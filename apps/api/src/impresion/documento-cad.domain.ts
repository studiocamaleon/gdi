import { errorPaginasDocumento } from '../common/rangos-paginas';
import {
  errorMedidasDocumento,
  medidasSeleccionadas,
  type MedidaPagina,
} from '../common/medidas-documento';
import {
  errorCopiasPorPagina,
  mapaCopiasCad,
} from '../common/copias-paginas-cad';
import type { PlanDocumento } from './documentos-orden.domain';

/** El número de página siempre pertenece al original, también con rangos. */
export type PaginaCadImprimible = MedidaPagina & {
  pagina: number;
  copias: number;
};
export function planDocumentoCad(meta: Record<string, unknown>): PlanDocumento {
  const doc = {
    modo: 'CAD' as const,
    paginas: Number(meta.paginas),
    paginasOriginales: Number(meta.paginasOriginales ?? meta.paginas),
    rangoPaginas:
      typeof meta.rangoPaginas === 'string' ? meta.rangoPaginas : '',
    archivoNombre: String(meta.archivoNombre ?? ''),
    copias: Number(meta.copias),
    copiasPorPagina: meta.copiasPorPagina as
      | { pagina: number; copias: number }[]
      | undefined,
    medidasPaginas: meta.medidasPaginas as MedidaPagina[] | undefined,
  };
  const cad = meta.cad as
    | { perfilId?: string; versionPerfil?: number; versionDestino?: number }
    | undefined;
  let motivo =
    errorPaginasDocumento(doc) ||
    errorMedidasDocumento(doc) ||
    errorCopiasPorPagina(doc);
  if (
    !cad?.perfilId ||
    !Number.isSafeInteger(cad.versionPerfil) ||
    !Number.isSafeInteger(cad.versionDestino) ||
    !doc.medidasPaginas?.length ||
    meta.faz !== 1 ||
    meta.escala !== 100 ||
    !['BN', 'COLOR'].includes(String(meta.color))
  )
    motivo =
      'Faltan las medidas o el perfil CAD cotizado. Volvé a cotizar el plano.';
  if (
    !Number.isSafeInteger(doc.copias) ||
    doc.copias < 1 ||
    doc.copias > 10000 ||
    doc.paginas > 5000
  )
    motivo = 'Revisá las páginas y copias del plano.';
  const excepciones = motivo ? new Map<number, number>() : mapaCopiasCad(doc);
  const paginasCad: PaginaCadImprimible[] = motivo
    ? []
    : medidasSeleccionadas(doc.medidasPaginas, doc.rangoPaginas).map((p) => ({
        ...p,
        copias: excepciones.get(p.pagina) ?? doc.copias,
      }));
  const hojas = paginasCad.reduce((n, p) => n + p.copias, 0);
  if (
    !motivo &&
    (hojas !== Number(meta.hojas) ||
      hojas > 10000 ||
      paginasCad.length !== doc.paginas)
  )
    motivo = 'Las cantidades del plano cambiaron. Volvé a cotizarlo.';
  return {
    configuracion: {
      papelMateriaPrimaId: String(meta.papelMateriaPrimaId ?? ''),
      papelNombre: String(meta.papelLabel ?? ''),
      gramaje: Number(meta.gramaje),
      tamano: 'CAD',
      color: String(meta.color),
      faz: 1,
      cad: {
        perfilId: String(cad?.perfilId ?? ''),
        versionPerfil: Number(cad?.versionPerfil),
        versionDestino: Number(cad?.versionDestino),
        materialVarianteId: String(meta.materialVarianteId ?? ''),
        rutaAlternativaId: String(meta.rutaAlternativaId ?? ''),
      },
    },
    nombre: String(meta.nombre ?? doc.archivoNombre),
    copias: doc.copias,
    paginas: doc.paginas,
    hojas,
    faz: 1,
    motivo,
    orientacion: null,
    paginasCad,
    segmentos: [
      {
        nombre: doc.archivoNombre,
        paginas: doc.paginas,
        paginasOriginales: doc.paginasOriginales,
        rangoPaginas: doc.rangoPaginas,
        faz: 1,
      },
    ],
  };
}
