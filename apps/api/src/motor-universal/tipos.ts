/**
 * Tipos del Motor Universal por Pasos.
 *
 * Define las estructuras de input y output del motor. La lógica vive en
 * `motor.service.ts`.
 *
 * Ver `docs/motor-por-pasos-analisis/04-modelo-conceptual-motor.md`.
 */

// ============================================================================
// INPUT — Lo que el motor recibe
// ============================================================================

export interface CotizarInput {
  /** ID del tenant (multi-tenant). */
  tenantId: string;
  /** ID del producto a cotizar. */
  productoId: string;
  /** ID de la ruta alternativa elegida (si null, usa la preferida del producto). */
  rutaAlternativaId?: string | null;
  /** Inputs del comercial al cotizar (cantidad, medidas, opcionales activados, etc.). */
  jobContext: JobContext;
  /** Cliente al que se cotiza (opcional, para precios especiales). */
  clienteId?: string | null;
  /** Período de tarifas a usar (ej: "2026-04"). Si null, usa el último publicado. */
  periodo?: string | null;
}

/**
 * Job Context — el "estado" del trabajo de cotización.
 * El motor lo lee de los inputs del comercial y lo va MUTANDO a medida
 * que ejecuta pasos (los pasos PRE pueden modificar medidas, etc.).
 */
export interface JobContext {
  /** Cantidad pedida (talonarios, tarjetas, etc.). */
  cantidad: number;
  /** Lista de piezas para nesting (gap H7 — multi-medida). */
  piezas?: Array<{ cantidad: number; anchoMm: number; altoMm: number }>;
  /** Medidas custom cuando producto.modoMedidas = LIBRE. */
  medidaCustomMm?: { anchoMm: number; altoMm: number };
  /** Multiplicador caras (1 simple faz, 2 doble faz). */
  caras?: 1 | 2;
  /** Multi-copia para talonarios (1 simple, 2 duplicado, 3 triplicado). */
  tipoCopia?: 1 | 2 | 3;
  /** Hojas por talonario (ej: 50, 100). */
  numerosXTalonario?: number;
  /** Tintas adicionales para impresión rígida (barniz, blanco). */
  tintasAdicionales?: string[];
  /** Modo de color comercial global de compatibilidad (preferir modoColor_<configPasoId>). */
  modoColor?: string;
  /** Modo de color comercial por configPasoId/rutaPasoId. Sobrevive al ValidationPipe. */
  modoColorPorPaso?: Record<string, string>;
  /** Tecnología elegida (M-2): ecosolvente, latex, uv. */
  tecnologia?: string;
  /** Distancia para cargo directo combustible (km). */
  distanciaKm?: number;
  /** Para instalación: m² instalados. */
  m2_instalados?: number;
  /** Para instalación: zona elegida. */
  zonaInstalacion?: string;
  /** Map booleano: opcionales activados por el comercial (key = configPasoId). */
  opcionalesActivados?: Record<string, boolean>;
  /** Materiales elegidos explícitamente por el comercial (key = configPasoId_slotCodigo). */
  slotMateriales?: Record<string, string>;
  /** Configuración runtime de cada paso (key = configPasoId). */
  configPasoRuntime?: Record<string, Record<string, unknown>>;
  /** Cualquier otro campo dinámico que el comercial cargue. */
  [key: string]: unknown;
}

// ============================================================================
// OUTPUT — Lo que el motor devuelve
// ============================================================================

export interface CotizarOutput {
  /** Si la cotización tuvo éxito (sin errores que cortan). */
  exitoso: boolean;
  /** Errores tipados que cortaron la cotización (D.7 Tipo B + C). */
  errores: ErrorMotor[];
  /** Cotización (presente si exitoso=true). */
  cotizacion?: CotizacionResultado;
}

export interface CotizacionResultado {
  /** Producto cotizado. */
  productoId: string;
  productoNombre: string;
  /** Ruta alternativa usada. */
  rutaAlternativaId: string;
  rutaNombre: string;
  /** Cantidad efectivamente producida (puede diferir de pedida en talonarios pose_completa). */
  cantidadEfectiva: number;
  cantidadPedida: number;
  /** Cantidad comercial usada para precio y costo unitario comercial. */
  cantidadComercialPricing: number;
  /** Unidad comercial fuente de la cantidad de pricing. */
  unidadComercialPricing: string;
  /** Costos por bucket (a-g del molde). */
  costos: {
    tiempoTotal: number;
    materialesTotal: number;
    cargosDirectosTotal: number;
    total: number;
    unitario: number;
  };
  /** Precio calculado por el Tab Precio (F.2.12). Legacy — sin impuestos ni
   * comisiones; se mantiene por compatibilidad con tests viejos. UI nueva
   * lee `desglosePrecio`. */
  precio?: {
    metodoUsado: string;
    precioUnitario: number;
    precioTotal: number;
    margenAplicadoPct?: number;
    margenNegativo: boolean;
    mensaje?: string;
  };
  /** Sprint 5.a — Desglose completo del precio con impuestos + comisiones +
   * override por cliente. Lo aplica `AplicarPrecioService` desde el motor.
   * undefined si el producto no tiene `precioConfigJson`. */
  desglosePrecio?: {
    /** Snapshot del precioConfig efectivo usado (override o standard). */
    precioConfig: { metodoCalculo: string; detalle: Record<string, unknown> };
    /** Lista de impuestos aplicados (snapshot del catálogo). */
    impuestos: Array<{
      catalogoId: string;
      codigo: string;
      nombre: string;
      porcentaje: number;
      orden: number;
    }>;
    /** Lista de comisiones aplicadas. */
    comisiones: Array<{
      catalogoId: string;
      codigo: string;
      nombre: string;
      porcentaje: number;
      orden: number;
    }>;
    /** Si el cliente tenía precio especial activo, snapshot del override. */
    precioEspecialCliente: {
      precioEspecialId: string;
      clienteId: string;
    } | null;
    precioBase: number;
    totalComisiones: number;
    totalImpuestos: number;
    margenEfectivoPct: number;
    precioNetoUnitario: number;
    precioBrutoUnitario: number;
    precioNetoTotal: number;
    precioBrutoTotal: number;
  };
  /** Trazabilidad por paso (orden topológico). */
  pasos: PasoEjecutado[];
  /** Cargos directos a nivel cotización (ej: viático, recargo urgencia). */
  cargosDirectosCotizacion: CargoDirectoEjecutado[];
}

export interface PasoEjecutado {
  rutaPasoId: string;
  rutaPasoOrden: number;
  familiaCodigo: string;
  /** Configuración del producto para este paso. */
  configPasoId: string;
  /** Si se activó (true/false según D.1). */
  activado: boolean;
  /** Razón si NO se activó (ej: "no es OBLIGATORIO + el comercial no lo activó"). */
  razonNoActivado?: string;
  /** Tiempo calculado (si activado). */
  tiempo?: {
    setupMin: number;
    runMin: number;
    cleanupMin: number;
    tiempoFijoMin: number;
    totalMin: number;
    /** Centro de costo usado para tarifar este tiempo. */
    centroCostoId?: string | null;
    centroCostoNombre?: string | null;
    /** Tarifa horaria del centro de costo aplicada. */
    tarifaHora?: number;
    costo: number;
  };
  /** Materiales consumidos (si activado). */
  materiales?: MaterialEjecutado[];
  /** Cargos directos a nivel paso (si activado). */
  cargosDirectosPaso?: CargoDirectoEjecutado[];
  /** Costo total del paso (tiempo + materiales + cargos). */
  costoTotal: number;
  /** Outputs canónicos que el paso escribió al JobContext. */
  outputsCanonicos?: Record<string, unknown>;
  /**
   * Resultado del nesting cuando el paso usa `mecanismoCantidad =
   * CALCULADO_POR_PASO` y la familia tiene un algoritmo soportado por el
   * dispatcher (G-M1). Trae la cantidad calculada real (con desperdicio) +
   * placements para visualización en frontend.
   */
  nestingResult?: NestingEjecutado;
}

/** Resultado del nesting visible al consumidor (motor, frontend). */
export interface NestingEjecutado {
  algorithm:
    | 'shelf-rollo'
    | 'maxrects-rollo'
    | 'grid-2d-single'
    | 'grid-2d-multi'
    | 'packingsolver-rectangle';
  /** Cantidad calculada en su unidad (m_lineales, pliegos, m2, piezas). */
  cantidadCalculada: number;
  unidad: 'm_lineales' | 'pliegos' | 'm2' | 'piezas';
  aprovechamientoPct: number;
  /** Sustratos consumidos. Para visualizar el "envase" (rollo o pliego). */
  substrates: Array<
    | { kind: 'sheet'; count: number; widthMm: number; heightMm: number }
    | { kind: 'roll'; lengthMm: number; widthMm: number }
  >;
  /** Placements para dibujar piezas dentro del sustrato. */
  placements: Array<{
    pieceId: string;
    substrateIndex?: number;
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    rotated: boolean;
    panelIndex?: number;
    panelCount?: number;
    panelAxis?: 'vertical' | 'horizontal';
    usefulWidthMm?: number;
    usefulHeightMm?: number;
    overlapStartMm?: number;
    overlapEndMm?: number;
    meta?: unknown;
  }>;
  piezasPorPliego?: number;
  consumedLengthMm?: number;
  piezasAcomodadas: number;
  /** Datos normalizados para que el SVG muestre cómo pensó el motor. */
  visualConfig?: NestingVisualConfig;
  /** Outputs canónicos publicados por el paso que generó este nesting. */
  outputsCanonicos?: Record<string, unknown>;
  /** Overlay/resumen del costeo de sustrato asociado al nesting. */
  costingPreview?: NestingCostingPreview;
  /** v3.1: solo cuando se aplicó talonario-grouping (post-nesting). */
  talonarioGrouping?: {
    talonariosEfectivos: number;
    talonariosPedidos: number;
    posesXPliego: number;
    talonariosPorGrupo: number;
    gruposCompletos: number;
    talonariosResiduo: number;
    pliegosXCapa: number;
    pliegosDesperdicio: number;
    numerosXTalonario: number;
    modoIncompleto: string;
  };
}

export interface NestingVisualConfig {
  margins: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;
  };
  spacing: {
    horizontalMm: number;
    verticalMm: number;
  };
  pieceBleedMm?: number;
  allowRotation: boolean;
  substrateLabel?: string;
  usableArea: {
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
  };
  printableArea?: {
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
  };
  panelizado?: {
    enabled: boolean;
    mode: 'automatic' | 'manual';
    axis: 'automatic' | 'vertical' | 'horizontal' | null;
    overlapMm: number | null;
    maxPanelWidthMm: number | null;
    distribution: 'equilibrada' | 'libre' | null;
    widthInterpretation: 'total' | 'util' | null;
    panelCount: number;
  };
}

export interface NestingCostingPreview {
  strategy: 'simple' | 'm2-exact' | 'consumed-length' | 'plate-segments';
  label: string;
  chargedRatio?: number;
  chargedLengthMm?: number;
  chargedAreaMm2?: number;
  chargedBounds?: {
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
  };
  wasteAreaMm2?: number;
  segmentAppliedPct?: number | null;
}

export interface MaterialEjecutado {
  slotCodigo: string;
  materialVarianteId: string;
  /** Compatibilidad histórica: antes era el SKU. Se mantiene sin cambios. */
  materialNombre: string;
  materialSku: string;
  materialDisplayName: string;
  materiaPrimaNombre?: string | null;
  tipoLineaCosto: 'MATERIAL' | 'CONSUMIBLE_MAQUINA';
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  costoTotal: number;
  /** Estrategia usada (simple, m2-exact, etc.). */
  estrategiaCosto: string;
  /** Desglose cuando el costo del material se calculó desde el nesting. */
  detalleCosteoNesting?: {
    strategy: string;
    totalCost: number;
    unitPrice: number;
    pricePerM2: number;
    fullUnits: number;
    fullUnitsCost: number;
    lastUnit: {
      occupationPct: number;
      segmentApplied: number | null;
      cost: number;
    } | null;
  };
  /** Modo de selección que se aplicó. */
  modoSeleccion:
    | 'HARDCODED'
    | 'COMERCIAL_ELIGE'
    | 'MOTOR_ELIGE_AUTO'
    | 'MAQUINA_CONSUMIBLE';
}

export interface CargoDirectoEjecutado {
  cargoDirectoCatalogoId: string;
  cargoCodigo: string;
  cargoNombre: string;
  modoCalculo:
    | 'MONTO_FIJO_PLANO'
    | 'PORCENTAJE_SOBRE_BASE'
    | 'POR_UNIDAD_INPUT';
  monto: number;
  detalle?: Record<string, unknown>;
}

// ============================================================================
// ERRORES
// ============================================================================

export type SeveridadError = 'ERROR' | 'WARNING';

export interface ErrorMotor {
  /** Código único de la validación que falló. */
  codigo: string;
  /** Severidad (ERROR siempre en D.7; WARNING reservado para D.8). */
  severidad: SeveridadError;
  /** Mensaje humano con valores interpolados. */
  mensaje: string;
  /** Paso donde se detectó (si aplica). */
  rutaPasoId?: string;
  rutaPasoOrden?: number;
  familiaCodigo?: string;
  /** Contexto del error (valores que causaron la falla). */
  contexto?: Record<string, unknown>;
  /** Sugerencia para resolver. */
  sugerencia?: string;
}

// ============================================================================
// Helpers internos del motor
// ============================================================================

/** Producto + ruta + configuraciones cargados del DB, listos para iterar. */
export interface ProductoCargado {
  productoId: string;
  productoCodigo: string;
  productoNombre: string;
  unidadComercial: string;
  modoMedidas: string;
  /**
   * Medida default del producto (modoMedidas = FIJA o COMERCIAL_ELIGE). Cuando
   * el comercial NO carga `piezas[]` ni `medidaCustomMm` en el JobContext, el
   * dispatcher de nesting (pre_prensa look-ahead) usa estos valores como
   * fallback. Si el producto no las declara, el dispatcher falla y el motor
   * cae al comportamiento histórico.
   */
  medidaDefaultAnchoMm: number | null;
  medidaDefaultAltoMm: number | null;
  precioConfigJson?: unknown;
  rutaAlternativaId: string;
  rutaAlternativaNombre: string;
  rutaId: string;
  rutaCodigo: string;
  rutaNombre: string;
  pasos: PasoCargado[];
  cargosDirectosCotizacion: CargoCotizacionCargado[];
}

export interface PasoCargado {
  rutaPasoId: string;
  rutaPasoOrden: number;
  familiaCodigo: string;
  configPasoId: string;
  modoActivacion: string | null;
  condicionActivacionJson: unknown;
  modoTiempo: string | null;
  mecanismoCantidad: string | null;
  mecanismoCantidadConfigJson: unknown;
  multiplicadoresActivos: string[];
  paramsPasoJson: unknown;
  maquinaM1Id: string | null;
  perfilM1Id: string | null;
  centroCostoId: string | null;
  setupOverrideMin: number | null;
  cleanupOverrideMin: number | null;
  tiempoFijoOverrideMin: number | null;
  /** Detalles de la máquina (cargados del JOIN). */
  maquina?: {
    id: string;
    codigo: string;
    nombre: string;
    plantilla: string;
    anchoUtil?: number | null;
    centroCostoPrincipalId?: string | null;
    centroCostoPrincipalNombre?: string | null;
    parametrosTecnicosJson?: Record<string, unknown> | null;
    consumibles?: ConsumibleMaquinaCargado[];
  };
  /** Detalles del perfil (cargados del JOIN). */
  perfil?: {
    id: string;
    nombre: string;
    tipoPerfil?: string | null;
    productivityValue: number | null;
    productivityUnit: string | null;
    setupMin: number | null;
    cleanupMin: number | null;
    detalleJson?: unknown;
  };
  /** Centro de costo manual para pasos sin máquina. */
  centroCosto?: {
    id: string;
    codigo: string;
    nombre: string;
  };
  /**
   * G-F2 — Máquinas candidatas M-2 declaradas para este paso.
   * Cuando hay >1 candidata, el comercial puede elegir desde el cotizador
   * vía `jobContext[\`maquinaSeleccionada_${configPasoId}\`] = maquinaId`.
   * Si no eligió, el motor usa la `esPreferida` o la primera; si tampoco
   * hay candidatas, usa la M-1 default (`maquinaM1Id`).
   */
  maquinasCandidatas?: Array<{
    id: string;
    maquinaId: string;
    esPreferida: boolean;
    orden: number;
    maquina: {
      id: string;
      codigo: string;
      nombre: string;
      plantilla: string;
      anchoUtil?: number | null;
      centroCostoPrincipalId?: string | null;
      centroCostoPrincipalNombre?: string | null;
      parametrosTecnicosJson?: Record<string, unknown> | null;
      consumibles?: ConsumibleMaquinaCargado[];
    };
    perfilesOperativos: Array<{
      id: string;
      nombre: string;
      tipoPerfil?: string | null;
      activo: boolean;
      productivityValue: number | null;
      productivityUnit: string | null;
      setupMin: number | null;
      cleanupMin: number | null;
      detalleJson: unknown;
    }>;
  }>;
  /** Otros perfiles disponibles de la máquina M-1 (para selección automática). */
  perfilesDisponibles?: Array<{
    id: string;
    nombre: string;
    tipoPerfil?: string | null;
    activo: boolean;
    productivityValue: number | null;
    productivityUnit?: string | null;
    setupMin: number | null;
    cleanupMin: number | null;
    detalleJson: unknown;
  }>;
  slots: SlotCargado[];
  /** Cargos directos a nivel PASO declarados por el producto (G-M3). */
  cargosDirectosPaso: CargoPasoCargado[];
}

export interface ConsumibleMaquinaCargado {
  id: string;
  perfilOperativoId: string | null;
  nombre: string;
  tipo: string;
  unidad: string;
  rendimientoEstimado: number | null;
  consumoBase: number | null;
  activo: boolean;
  detalleJson: unknown;
  materialVariante: {
    id: string;
    sku: string;
    nombreVariante?: string | null;
    materiaPrimaNombre?: string | null;
    precioReferencia: number | null;
    unidadStock?: string | null;
    atributosVarianteJson?: Record<string, unknown> | null;
  };
}

export interface SlotCargado {
  id: string;
  slotCodigo: string;
  modoSeleccion: string;
  criterioMotorAuto?: string | null;
  criterioInputCampo?: string | null;
  criterioMaterialCampo?: string | null;
  materialVarianteId: string | null;
  candidatos: Array<{
    id: string;
    materiaPrimaId: string;
    defaultVarianteId: string | null;
    orden: number;
    variantes: Array<{
      varianteId: string;
      orden: number;
    }>;
  }>;
  estrategiaCosto: string;
  formula: string;
  aplicaMultiCaras: boolean;
  /** Material concreto si HARDCODED (o el resuelto en runtime). */
  materialVariante?: {
    id: string;
    sku: string;
    nombreVariante?: string | null;
    materiaPrimaNombre?: string | null;
    precioReferencia: number | null;
    atributosVarianteJson?: Record<string, unknown> | null;
    /** G-M9: unidad de stock heredada de la materia prima padre. */
    unidadStock?: string | null;
  };
}

export interface CargoCotizacionCargado {
  id: string;
  cargoDirectoCatalogoId: string;
  modoActivacion: string;
  condicionActivacionJson: unknown;
  configOverrideJson: unknown;
  catalogo: {
    codigo: string;
    nombre: string;
    modoCalculo: string;
    configJson: unknown;
  };
}

/**
 * Cargo directo asociado a un paso del producto (G-M3).
 * Misma estructura que CargoCotizacionCargado: la diferencia es el scope
 * (la base de PORCENTAJE_SOBRE_BASE es el subtotal del PASO, no de la cotización).
 */
export interface CargoPasoCargado {
  id: string;
  cargoDirectoCatalogoId: string;
  modoActivacion: string;
  condicionActivacionJson: unknown;
  configOverrideJson: unknown;
  catalogo: {
    codigo: string;
    nombre: string;
    modoCalculo: string;
    configJson: unknown;
  };
}
