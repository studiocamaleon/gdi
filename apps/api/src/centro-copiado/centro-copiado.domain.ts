import type { DocumentoInput } from './adaptador';

export const CENTRO_COPIADO_TERMINACIONES_CATALOGO = [
  {
    codigo: 'Anillado',
    etiqueta: 'Anillado',
    familiaCodigo: 'encuadernado_anillado',
    requiereMaquina: 'ANILLADORA',
  },
] as const;
export const CENTRO_COPIADO_TERMINACIONES =
  CENTRO_COPIADO_TERMINACIONES_CATALOGO.map(
    (terminacion) => terminacion.codigo,
  );

/** Formatos aceptados por el TPV. El backend valida nombre y medidas: el
 * cliente no puede alterar el factor de impresión enviando dimensiones libres. */
export const CENTRO_COPIADO_FORMATOS = [
  { nombre: 'A4', anchoMm: 210, altoMm: 297 },
  { nombre: 'A3', anchoMm: 297, altoMm: 420 },
  { nombre: 'Oficio', anchoMm: 216, altoMm: 356 },
  { nombre: 'SRA3', anchoMm: 325, altoMm: 475 },
  { nombre: 'SRA3+', anchoMm: 330, altoMm: 480 },
  { nombre: 'SRA3++', anchoMm: 325, altoMm: 500 },
] as const;
export const CENTRO_COPIADO_TIPOS_ANILLO = [
  'ESPIRAL_PLASTICO',
  'WIRE_O',
] as const;
export const CENTRO_COPIADO_COBERTURAS = [
  'borrador',
  'normal',
  'alta',
] as const;

export type CentroCopiadoTerminacion =
  (typeof CENTRO_COPIADO_TERMINACIONES_CATALOGO)[number]['codigo'];
export type CentroCopiadoTipoAnillo =
  (typeof CENTRO_COPIADO_TIPOS_ANILLO)[number];
export type CentroCopiadoCobertura = (typeof CENTRO_COPIADO_COBERTURAS)[number];

export interface CentroCopiadoSegmentoMeta {
  nombre: string | null;
  paginas: number;
  tamano: string;
  tamanoAnchoMm: number;
  tamanoAltoMm: number;
  papelMateriaPrimaId: string;
  gramaje: number | null;
  color: DocumentoInput['color'];
  faz: DocumentoInput['faz'];
  cobertura: string;
}

/** Contrato canónico persistido dentro de jobContext._centroCopiado. */
export interface CentroCopiadoMeta {
  version: 1;
  grupoCargaId: string;
  grupoTomoId: string | null;
  esTomo: boolean;
  tomoNombre: string | null;
  terminacion: string;
  terminaciones: string[];
  tipoAnillo: string | null;
  nombre?: string | null;
  paginas?: number;
  copias?: number;
  tamano?: string;
  tamanoAnchoMm?: number;
  tamanoAltoMm?: number;
  papelMateriaPrimaId?: string;
  gramaje?: number | null;
  papelLabel?: string;
  color?: DocumentoInput['color'];
  faz?: DocumentoInput['faz'];
  cobertura?: string;
  carillas?: number;
  hojas: number;
  juegos?: number;
  hojasPorLibro?: number;
  documentos?: number;
  segmentos?: CentroCopiadoSegmentoMeta[];
}

export function metaDocumentoCentroCopiado(args: {
  doc: DocumentoInput;
  grupoCargaId: string;
  grupoTomoId: string | null;
  tomoNombre: string | null;
  terminaciones: string[];
  tipoAnillo: string | null;
  copias: number;
  papelLabel: string;
  carillas: number;
  hojas: number;
}): CentroCopiadoMeta {
  const { doc } = args;
  return {
    version: 1,
    grupoCargaId: args.grupoCargaId,
    grupoTomoId: args.grupoTomoId,
    esTomo: false,
    tomoNombre: args.tomoNombre,
    terminacion: args.terminaciones.length
      ? args.terminaciones.join(', ')
      : 'Ninguna',
    terminaciones: args.terminaciones,
    tipoAnillo: args.tipoAnillo,
    nombre: doc.nombre ?? null,
    paginas: doc.paginas,
    copias: args.copias,
    tamano: doc.tamano,
    tamanoAnchoMm: doc.tamanoAnchoMm,
    tamanoAltoMm: doc.tamanoAltoMm,
    papelMateriaPrimaId: doc.papelMateriaPrimaId,
    gramaje: doc.gramaje ?? null,
    papelLabel: args.papelLabel,
    color: doc.color,
    faz: doc.faz,
    cobertura: doc.cobertura ?? 'alta',
    carillas: args.carillas,
    hojas: args.hojas,
  };
}

export function metaTomoCentroCopiado(args: {
  docs: DocumentoInput[];
  grupoCargaId: string;
  tomoNombre: string;
  terminaciones: string[];
  tipoAnillo: string | null;
  juegos: number;
  hojasPorLibro: number;
  hojas: number;
}): CentroCopiadoMeta {
  return {
    version: 1,
    grupoCargaId: args.grupoCargaId,
    grupoTomoId: null,
    esTomo: true,
    tomoNombre: args.tomoNombre,
    terminacion: args.terminaciones.length
      ? args.terminaciones.join(', ')
      : 'Ninguna',
    terminaciones: args.terminaciones,
    tipoAnillo: args.tipoAnillo,
    juegos: args.juegos,
    hojasPorLibro: args.hojasPorLibro,
    hojas: args.hojas,
    documentos: args.docs.length,
    segmentos: args.docs.map((doc) => ({
      nombre: doc.nombre ?? null,
      paginas: doc.paginas,
      tamano: doc.tamano,
      tamanoAnchoMm: doc.tamanoAnchoMm,
      tamanoAltoMm: doc.tamanoAltoMm,
      papelMateriaPrimaId: doc.papelMateriaPrimaId,
      gramaje: doc.gramaje ?? null,
      color: doc.color,
      faz: doc.faz,
      cobertura: doc.cobertura ?? 'alta',
    })),
  };
}

export function errorEstructuraCargaCentroCopiado(
  documentos: Array<{ id: string; nombre?: string; grupoId?: string | null }>,
  grupos: Array<{ id: string; nombre?: string }> = [],
): string | null {
  const idsDocumentos = documentos.map((documento) => documento.id);
  if (new Set(idsDocumentos).size !== idsDocumentos.length) {
    return 'Hay documentos repetidos en la carga.';
  }
  const idsGrupos = grupos.map((grupo) => grupo.id);
  if (new Set(idsGrupos).size !== idsGrupos.length) {
    return 'Hay tomos repetidos en la carga.';
  }
  const gruposValidos = new Set(idsGrupos);
  for (const documento of documentos) {
    if (documento.grupoId && !gruposValidos.has(documento.grupoId)) {
      return `El documento "${documento.nombre ?? documento.id}" referencia un tomo inexistente.`;
    }
  }
  for (const grupo of grupos) {
    if (!documentos.some((documento) => documento.grupoId === grupo.id)) {
      return `El tomo ${grupo.nombre ?? grupo.id} está vacío.`;
    }
  }
  return null;
}
