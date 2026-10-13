import type {
  ConfiguracionCad,
  planPaginaCad,
} from '../../common/cad-geometria';
import type { DocumentoInput } from '../adaptador';
import type { CentroCopiadoCobertura } from '../centro-copiado.domain';
import type { EstadoPrecioMatriz } from './tipos';

export interface ReglasComercialesCad {
  unidad: 'ML';
  acumulacion: 'COMBINACION' | 'ARCHIVO';
  cobertura: 'UNICA' | 'DIFERENCIADA';
  redondeo:
    | { modalidad: 'SIN_REDONDEO' }
    | { modalidad: 'HACIA_ARRIBA'; incrementoMl: string };
}

export const REGLAS_COMERCIALES_CAD_INICIALES: Readonly<ReglasComercialesCad> =
  Object.freeze({
    unidad: 'ML',
    acumulacion: 'COMBINACION',
    cobertura: 'UNICA',
    redondeo: Object.freeze({ modalidad: 'SIN_REDONDEO' }),
  });

export interface CombinacionComercialCad {
  papelMateriaPrimaId: string;
  gramaje: number | null;
  anchoRolloMm: number;
  color: DocumentoInput['color'];
  /** null sólo cuando el precio no distingue coberturas. CAD siempre simple faz. */
  cobertura: CentroCopiadoCobertura | null;
}

export interface FilaMatrizCad {
  combinacion: Readonly<CombinacionComercialCad>;
  rangosPropios?: readonly string[] | null;
  precios: readonly { desdeCantidad: string; precioUnitario: string | null }[];
}

/** Sección CAD de una versión resuelta por el servidor, no un DTO público. */
export interface TarifarioCalculoCad {
  tenantId: string;
  tarifarioId: string;
  versionId: string;
  reglas: Readonly<ReglasComercialesCad>;
  /** ML: límites inferiores inclusivos desde 0, último abierto. */
  rangosGenerales: readonly string[];
  filas: readonly FilaMatrizCad[];
}

export type DocumentoCalculoCad = Omit<DocumentoInput, 'modo' | 'gramaje'> & {
  modo: 'CAD';
  gramaje: number | null;
  /** El servidor resuelve la oferta y configuración productiva antes de calcular. */
  rolloProduccion: Pick<ConfiguracionCad, 'anchoRolloMm' | 'margenMm'>;
};

export interface PedidoCalculoCad {
  tenantId: string;
  pedidoId: string;
  cargas: readonly { id: string; documentos: readonly DocumentoCalculoCad[] }[];
}

export interface ParteComercialCad {
  referencia: { cargaId: string; documentoId: string; paginaOriginal: number };
  combinacion: CombinacionComercialCad;
  coberturaProduccion: CentroCopiadoCobertura;
  copiasEfectivas: number;
  margenMm: number;
  plan: ReturnType<typeof planPaginaCad>;
  /** Largo de salida por copia, sumado en decimal desde orientación y márgenes. */
  largoPapelMm: string;
  consumoMlPorCopia: string;
  consumoMl: string;
}

export interface GrupoComercialCad {
  clave: string;
  combinacion: CombinacionComercialCad;
  unidad: 'ML';
  impresionesFisicas: number;
  cantidadParaTramo: string;
  cantidadFacturable: string;
  ajusteRedondeoMl: string;
  tramo: {
    desdeCantidad: string;
    /** Intervalo continuo [desde, hasta); nunca restar una hoja ni un épsilon. */
    hastaCantidadExclusiva: string | null;
    origen: 'GENERAL' | 'COMBINACION';
  };
  estado: EstadoPrecioMatriz;
  motivoPendiente: 'COMBINACION_SIN_PRECIO' | 'TRAMO_SIN_PRECIO' | null;
  precioUnitario: string | null;
  importeConsumoMatriz: string | null;
  importeAjusteRedondeo: string | null;
  importeMatriz: string | null;
  /** El ajuste comercial pertenece al grupo; no repetirlo en sus partes. */
  partes: Array<ParteComercialCad & { importeConsumoMatriz: string | null }>;
}

/** Importes exactos en la convención del tarifario, antes de IVA y adicionales. */
export interface CalculoComercialCad {
  tenantId: string;
  pedidoId: string;
  tarifarioId: string;
  versionId: string;
  reglas: ReglasComercialesCad;
  estado: EstadoPrecioMatriz;
  grupos: GrupoComercialCad[];
  impresionesFisicas: number;
  consumoMl: string;
  cantidadFacturable: string;
  ajusteRedondeoMl: string;
  importeConPrecio: string;
  importeImpresionMatriz: string | null;
}
