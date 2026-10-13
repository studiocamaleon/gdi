import type { DocumentoInput } from '../adaptador';
import type { CentroCopiadoCobertura } from '../centro-copiado.domain';

export interface ReglasComercialesHojas {
  unidad: 'HOJA' | 'CARILLA';
  acumulacion: 'COMBINACION' | 'ARCHIVO';
  ultimaHojaImpar: 'MANTENER_DOBLE' | 'COBRAR_SIMPLE';
  cobertura: 'UNICA' | 'DIFERENCIADA';
}

export const REGLAS_COMERCIALES_HOJAS_INICIALES: Readonly<ReglasComercialesHojas> =
  Object.freeze({
    unidad: 'HOJA',
    acumulacion: 'COMBINACION',
    ultimaHojaImpar: 'MANTENER_DOBLE',
    cobertura: 'UNICA',
  });

export interface CombinacionComercialHojas {
  papelMateriaPrimaId: string;
  gramaje: number | null;
  tamano: string;
  color: DocumentoInput['color'];
  faz: DocumentoInput['faz'];
  /** null sólo en modalidad de precio único para todas las coberturas. */
  cobertura: CentroCopiadoCobertura | null;
}

export interface FilaMatrizHojas {
  combinacion: Readonly<CombinacionComercialHojas>;
  /** Ausente/null hereda; una lista propia nunca se mezcla con la general. */
  rangosPropios?: readonly number[] | null;
  precios: readonly {
    desdeCantidad: number;
    /** Decimal exacto. null o celda ausente = pendiente; "0" es precio explícito. */
    precioUnitario: string | null;
  }[];
}

/** Sección hojas de una versión resuelta por el servidor, no un DTO público. */
export interface TarifarioCalculoHojas {
  tenantId: string;
  tarifarioId: string;
  versionId: string;
  reglas: Readonly<ReglasComercialesHojas>;
  /** Límites inferiores inclusivos; desde 1, sin duplicados, último sin tope. */
  rangosGenerales: readonly number[];
  filas: readonly FilaMatrizHojas[];
}

/** El caller resuelve el gramaje efectivo antes de tarifar. null = sin gramaje. */
export type DocumentoCalculoHojas = Omit<DocumentoInput, 'modo' | 'gramaje'> & {
  modo?: 'HOJAS';
  gramaje: number | null;
};

export interface CargaCalculoHojas {
  id: string;
  documentos: readonly DocumentoCalculoHojas[];
  grupos?: readonly { id: string; nombre?: string; juegos: number }[];
}

/** Todas las cargas de hojas del pedido, incluidas las agregadas anteriormente. */
export interface PedidoCalculoHojas {
  tenantId: string;
  pedidoId: string;
  cargas: readonly CargaCalculoHojas[];
}

export interface ReferenciaDocumentoComercial {
  cargaId: string;
  documentoId: string;
  grupoTomoId: string | null;
}

export interface ParteComercialHojas {
  referencia: ReferenciaDocumentoComercial;
  combinacion: CombinacionComercialHojas;
  /** Páginas seleccionadas del original por copia, antes de separar las caras. */
  paginasPorCopia: number;
  copiasEfectivas: number;
  fazProduccion: DocumentoInput['faz'];
  coberturaProduccion: CentroCopiadoCobertura;
  hojasFisicas: number;
  carillasImpresas: number;
  cantidadComercial: number;
}

export interface TramoComercialHojas {
  desdeCantidad: number;
  hastaCantidad: number | null;
  origen: 'GENERAL' | 'COMBINACION';
}

export type EstadoPrecioMatriz = 'CALCULADO' | 'PRECIO_PENDIENTE';

export interface GrupoComercialHojas {
  clave: string;
  combinacion: CombinacionComercialHojas;
  unidad: ReglasComercialesHojas['unidad'];
  cantidadParaTramo: number;
  cantidadFacturable: number;
  hojasFisicas: number;
  carillasImpresas: number;
  tramo: TramoComercialHojas;
  estado: EstadoPrecioMatriz;
  motivoPendiente: 'COMBINACION_SIN_PRECIO' | 'TRAMO_SIN_PRECIO' | null;
  precioUnitario: string | null;
  importeMatriz: string | null;
  partes: Array<ParteComercialHojas & { importeMatriz: string | null }>;
}

/** Importes en la convención del tarifario, sin interpretar ni discriminar IVA.
 * Los ajustes y adicionales se resuelven en etapas posteriores.
 * No llamarlos neto/bruto/total de pedido hasta resolver esas etapas posteriores.
 * Se conservan decimales exactos; el redondeo monetario pertenece a la composición.
 */
export interface CalculoComercialHojas {
  tenantId: string;
  pedidoId: string;
  tarifarioId: string;
  versionId: string;
  reglas: ReglasComercialesHojas;
  estado: EstadoPrecioMatriz;
  grupos: GrupoComercialHojas[];
  hojasFisicas: number;
  carillasImpresas: number;
  cantidadComercial: number;
  importeConPrecio: string;
  /** null si alguna parte está pendiente; el parcial nunca parece un total válido. */
  importeImpresionMatriz: string | null;
}
