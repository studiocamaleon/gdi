/** Contratos internos del servidor: no son DTOs de precios enviados por el cliente. */
export interface ReglasComposicionComercial {
  iva: 'INCLUIDO' | 'MAS_IVA';
  preparacion:
    | { modalidad: 'INCLUIDA' }
    | { modalidad: 'FIJA_PEDIDO'; importe: string };
  minimo:
    | { modalidad: 'SIN_MINIMO' }
    | { modalidad: 'IMPORTE_PEDIDO'; importe: string };
}

export const REGLAS_COMPOSICION_COMERCIAL_INICIALES: Readonly<ReglasComposicionComercial> =
  Object.freeze({
    iva: 'INCLUIDO',
    preparacion: Object.freeze({ modalidad: 'INCLUIDA' }),
    minimo: Object.freeze({ modalidad: 'SIN_MINIMO' }),
  });

export interface ReferenciaComposicionComercial {
  tenantId: string;
  tarifarioId: string;
  versionId: string;
  monedaCodigo: string;
}

/** Sólo la política principal aporta preparación y mínimo, nunca sus respaldos. */
export interface PoliticaComposicionComercial extends ReferenciaComposicionComercial {
  reglas: Readonly<ReglasComposicionComercial>;
}

export interface ImporteImpresionResuelto {
  /** Clave del grupo comercial: se mantiene el vínculo con cantidades y tramos. */
  clave: string;
  /**
   * Importe TOTAL del concepto en la convención del tarifario principal.
   * El caller resuelve antes acuerdos, respaldos y ajustes autorizados, conserva
   * su auditoría y normaliza moneda/IVA. null sigue siendo precio pendiente.
   */
  importeResuelto: string | null;
  /** Alícuota efectiva resuelta por el sistema fiscal. Cero debe ser explícito. */
  ivaPorcentaje: string;
}

export interface DesgloseFiscalComercial {
  neto: string;
  iva: string;
  total: string;
}

export interface TerminacionComercialResuelta {
  clave: string;
  /** Importe total ya calculado, ajustado y redondeado por su propio recorrido. */
  fiscal: Readonly<DesgloseFiscalComercial> | null;
}

/**
 * Todos los conceptos de Centro de copiado del pedido (hojas y, luego, CAD).
 * No incluir otros productos ni enviar una llamada independiente por carga.
 * Permisos, oferta, vigencia, costos y margen se validan fuera de esta función.
 */
export interface PedidoComposicionComercial extends ReferenciaComposicionComercial {
  pedidoId: string;
  /** Resuelto desde moneda/redondeo del tenant; no modifica cantidades físicas. */
  decimalesPrecio: number;
  impresion: readonly ImporteImpresionResuelto[];
  preparacion: {
    ivaPorcentaje: string;
    /** Ajuste ya autorizado y auditado sobre el cargo fijo; ausencia usa la regla. */
    importeAjustado?: string;
  };
  /** No inferir de la primera impresión: lo resuelve el sistema fiscal. */
  ivaAjusteMinimoPorcentaje: string;
  terminaciones: readonly TerminacionComercialResuelta[];
}

export interface ConceptoCompuestoComercial {
  /** Importe antes del redondeo monetario; conserva la convención del tarifario. */
  importeResuelto: string | null;
  importeEnConvencion: string | null;
  ivaPorcentaje: string;
  fiscal: DesgloseFiscalComercial | null;
}

export interface ComposicionPedidoComercial extends ReferenciaComposicionComercial {
  pedidoId: string;
  decimalesPrecio: number;
  convencionIva: ReglasComposicionComercial['iva'];
  estado: 'CALCULADO' | 'PRECIO_PENDIENTE';
  impresion: Array<ConceptoCompuestoComercial & { clave: string }>;
  preparacion: ConceptoCompuestoComercial & { importeConfigurado: string };
  minimo: ConceptoCompuestoComercial & {
    importeConfigurado: string | null;
    /** Base redondeada de impresión + preparación, sin terminaciones. */
    baseComparada: string | null;
    /** Mínimo redondeado; cero si está deshabilitado o el pedido está vacío. */
    importeExigible: string;
  };
  subtotalImpresionPreparacion: DesgloseFiscalComercial | null;
  subtotalAntesTerminaciones: DesgloseFiscalComercial | null;
  terminaciones: TerminacionComercialResuelta[];
  subtotalTerminaciones: DesgloseFiscalComercial | null;
  /** Suma de conceptos conocidos, nunca utilizar como total si hay pendientes. */
  parcialConPrecio: DesgloseFiscalComercial;
  total: DesgloseFiscalComercial | null;
}
