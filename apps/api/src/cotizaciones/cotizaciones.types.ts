/** Contrato público, sin dependencias de Nest; también lo consume la barra web. */
export type CotizacionDolar = {
  id: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  referencia: number | null;
  tipoReferencia: 'FIX' | 'TRM' | 'Referencia' | null;
  fechaActualizacion: string;
};

export type DolarResponse = {
  paisCodigo: string;
  monedaLocal: string | null;
  estado: 'disponible' | 'sin_actualizar' | 'no_disponible' | 'sin_cobertura';
  principalId: string | null;
  campoPrincipal: 'venta' | 'referencia';
  cotizaciones: CotizacionDolar[];
  /** Última consulta exitosa; NO sustituye la fecha publicada por la fuente. */
  consultadoEn: string | null;
  proximaConsultaEn: string | null;
};

export const DOLAR_REFRESH_MS = 5 * 60 * 1000;
/** Umbral conservador que tolera fines de semana y feriados cortos. */
export const DOLAR_ANTIGUEDAD_MAX_MS = 96 * 60 * 60 * 1000;
