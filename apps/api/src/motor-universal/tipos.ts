/**
 * Tipos del Motor Universal por Pasos.
 *
 * Define las estructuras de input y output del motor. La lógica vive en
 * `motor.service.ts`.
 *
 * Ver `docs/motor-por-pasos-analisis/04-modelo-conceptual-motor.md`.
 */

import type { CapacidadEmitida } from '../productos-servicios/pasos/capacidades';

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
 * Lados de una pieza rectangular. Los pasos `modificacion_pre` declaran sobre
 * qué lados aplican la demasía; `colocacion_ojales`, sobre cuáles coloca.
 */
export type LadoPieza = 'superior' | 'inferior' | 'izquierdo' | 'derecho';

/**
 * Registro de UNA mutación aplicada por un paso `modificacion_pre`.
 *
 * Es la traza que necesita el desglose de la cotización y la OT para explicar
 * por qué el material mide más que lo que pidió el cliente (el operario corta
 * la medida `despues`, el cliente pidió la visible).
 */
export interface MutacionAplicada {
  rutaPasoId: string;
  nombrePaso: string;
  /** Preset del paso: `bolsillo` | `refuerzo`. */
  subTipo: string;
  lados: LadoPieza[];
  demasiaMm: number;
  /** Demasía total agregada a cada eje (demasiaMm × lados de ese eje). */
  deltaAnchoMm: number;
  deltaAltoMm: number;
  /** Metros lineales de unión, medidos sobre la medida VISIBLE. */
  metrosLinealesUnion: number;
  /** Medida antes y después, por pieza. Un solo item en el caso típico de lona. */
  piezas: Array<{
    antes: { anchoMm: number; altoMm: number };
    despues: { anchoMm: number; altoMm: number };
  }>;
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
  piezas?: Array<{
    cantidad: number;
    anchoMm: number;
    altoMm: number;
    perimetroMm?: number;
  }>;
  /** Medidas custom cuando el producto permite medida personalizada (LIBRE o MIXTA). */
  medidaCustomMm?: { anchoMm: number; altoMm: number };
  /**
   * INMUTABLE. Medida que pidió el cliente, congelada antes del primer paso
   * PRE. Los pasos que miden sobre el borde TERMINADO (soldadura de bolsillo,
   * colocación de ojales) leen de acá, no de `medidaCustomMm`/`piezas[]`, que
   * describen el material y sí crecen con la demasía.
   * Ver `docs/modificaciones-fisicas-lona-diseno.md` §3.
   */
  medidaVisibleMm?: { anchoMm: number; altoMm: number };
  /** INMUTABLE. Contraparte multi-pieza de `medidaVisibleMm`. */
  piezasVisibles?: Array<{
    cantidad: number;
    anchoMm: number;
    altoMm: number;
  }>;
  /**
   * Traza acumulada de las mutaciones que aplicaron los pasos `modificacion_pre`.
   * Se APPENDEA: no puede viajar como output canónico porque el merge del loop
   * hace `jobContext[key] = value` y un segundo paso PRE pisaría la traza del
   * primero (caso real: refuerzo + bolsillo, o refuerzo + ojales).
   */
  mutacionesAplicadas?: MutacionAplicada[];
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
  /**
   * Área total calculada desde las piezas comerciales. Describe el MATERIAL:
   * se recalcula cuando un paso PRE muta las medidas
   * (`recalcularMetricasDerivadasPiezas`).
   */
  piezaAreaTotalM2?: number;
  /**
   * Perímetro rectangular total de piezas en metros, útil para refilado/corte
   * manual. Describe el MATERIAL — para medir sobre el borde terminado
   * (ojales, soldadura) usar `piezasVisibles`.
   */
  piezaPerimetroTotalM?: number;
  /** Ancho máximo entre las piezas (material, se recalcula tras mutar). */
  piezaAnchoMaxMm?: number;
  /** Alto máximo entre las piezas (material, se recalcula tras mutar). */
  piezaAltoMaxMm?: number;
  /** Metros lineales comerciales o ingresados por el usuario. */
  metrosLineales?: number;
  metroLineal?: number;
  ml?: number;
  cantidadComercial?: number;
  cantidadComercialPricing?: number;
  /** Map booleano: opcionales activados por el comercial (key = configPasoId). */
  opcionalesActivados?: Record<string, boolean>;
  /** Materiales elegidos explícitamente por el comercial (key = configPasoId_slotCodigo). */
  slotMateriales?: Record<string, string>;
  /** Configuración runtime de cada paso (key = configPasoId). */
  configPasoRuntime?: Record<string, Record<string, unknown>>;
  /**
   * Cualquier otro campo dinámico que el comercial cargue. Claves con
   * namespace por paso: `modoColor_<configPasoId>`, `caras_<configPasoId>`,
   * `maquinaSeleccionada_<configPasoId>`, `tiempoManualMin_<configPasoId>`
   * (minutos estimados por el comercial — ver TiempoManualConfig).
   */
  [key: string]: unknown;
}

/**
 * Config de tiempo manual por paso (`paramsPasoJson.tiempoManual`).
 * Ver docs/tiempo-manual-por-paso-diseno.md: el comercial estima el tiempo
 * del paso al cotizar (diseño gráfico, corte láser) y el valor viaja en
 * `jobContext.tiempoManualMin_<configPasoId>` (SIEMPRE en minutos; la unidad
 * del input es solo presentación). Gana sobre cualquier modoTiempo.
 */
export interface TiempoManualConfig {
  habilitado: boolean;
  /** true = sin valor ingresado la cotización corta con `tiempo_manual_requerido`. */
  obligatorio?: boolean;
  /** Unidad de PRESENTACIÓN del input del comercial. Interno siempre minutos. */
  unidadInput?: 'min' | 'h';
  /** Valor inicial del input, en minutos. */
  defaultMin?: number | null;
  /** Cota inferior del input, en minutos (valida el sheet). */
  minMin?: number | null;
  /** Cota superior del input, en minutos (valida el sheet). */
  maxMin?: number | null;
  /** Label del input en el cotizador (default: nombre del paso). */
  etiqueta?: string | null;
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
  /** Cantidad comercial real pedida, antes de aplicar mínimos de facturación. */
  cantidadComercialReal: number;
  /** Cantidad comercial usada para precio. Puede incluir mínimos de facturación. */
  cantidadComercialPricing: number;
  /** Unidad comercial fuente de la cantidad de pricing. */
  unidadComercialPricing: string;
  minimoComercialAplicado?: {
    base: 'cantidad_comercial' | 'pliegos_impresos';
    cantidadMinima: number;
    cantidadReal: number;
    cantidadPricing: number;
    aplicado: boolean;
    unidadLabel: string;
    politica: string;
  } | null;
  /** Costos por bucket (a-g del molde). */
  costos: {
    tiempoTotal: number;
    materialesTotal: number;
    cargosDirectosTotal: number;
    /** Costo de pasos tercerizados (lo que se paga al proveedor). */
    tercerizadoTotal: number;
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
      desglosarCliente?: boolean;
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
  /** Nombre operativo final para propuesta/OT. */
  nombreVisible?: string | null;
  /** Configuración del producto para este paso. */
  configPasoId: string;
  /** Si se activó (true/false según D.1). */
  activado: boolean;
  /** Razón si NO se activó (ej: "no es OBLIGATORIO + el comercial no lo activó"). */
  razonNoActivado?: string;
  /**
   * El paso se encendió porque OTRO lo exige, no porque el comercial lo tildara
   * (ojales arrastra el refuerzo). Se muestra en el cotizador: si el precio
   * sube sin explicación, es peor que el bug. Ver `arrastre-opcionales.ts`.
   */
  activadoPorDependencia?: { requeridoPorNombre: string };
  /**
   * Sólo pasos `modificacion_pre`: qué medida agrandó y en cuánto. Alimenta el
   * desglose del cotizador y la doble medida de la OT (el operario corta la
   * medida `despues`, el cliente pidió la visible).
   */
  mutacionAplicada?: MutacionAplicada;
  /**
   * Sólo pasos `colocacion_ojales`: dónde va cada ojal, en coordenadas de la
   * medida VISIBLE. Lo dibuja el visor de nesting — las posiciones salen del
   * motor para que el dibujo no pueda contradecir al cálculo.
   */
  ojalesLayout?: Array<{
    anchoMm: number;
    altoMm: number;
    cantidad: number;
    posiciones: Array<{ xMm: number; yMm: number; lado: LadoPieza }>;
  }>;
  /**
   * Sólo pasos `colocacion_ojales`: cómo se pidieron. Va aparte del layout
   * porque describe el PASO, no cada pieza. Alimenta la spec de la ficha/OT.
   */
  ojalesConfig?: {
    separacionMaxMm: number;
    lados: LadoPieza[];
    esquinasSiempre: boolean;
  };
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
    /** Tarifa horaria del centro de costo aplicada (mezclada: máquina + MO). */
    tarifaHora?: number;
    /**
     * Minutos con operario cargado: en pasos con máquina = setup + cleanup +
     * tiempoFijo (no el run autónomo); en pasos sin máquina = totalMin.
     */
    /** Operarios que ocupa el paso (multiplica el costo de mano de obra). */
    dotacionOperarios?: number;
    costo: number;
    /**
     * Origen del tiempo del paso: `manual_comercial` cuando el comercial lo
     * estimó al cotizar (tiempo manual). Ausente = calculado por el motor.
     */
    origenTiempo?: 'manual_comercial' | 'calculado';
  };
  /** Materiales consumidos (si activado). */
  materiales?: MaterialEjecutado[];
  /** Cargos directos a nivel paso (si activado). */
  cargosDirectosPaso?: CargoDirectoEjecutado[];
  /** El paso lo compró un proveedor (no consume máquina ni tiempo interno). */
  tercerizado?: boolean;
  proveedorId?: string | null;
  plazoProveedorDias?: number | null;
  /** Detalle del costeo tercerizado, para desglose/UI. */
  tercerizadoDetalle?: {
    fuente: string;
    magnitud?: string;
    valorMagnitud?: number;
    tarifa?: number;
    entradaClave?: string;
  };
  /** Atributos elegidos del paso tercerizado (eje→valor) con sus etiquetas,
   *  para mostrarlos en Especificaciones. Ej: [{eje:"Papel", valor:"Ilus 150"}]. */
  tercerizadoEtiquetas?: Array<{ eje: string; valor: string }>;
  /** Tecnología asignada manualmente al paso tercerizado (para que los reportes
   *  lo clasifiquen aunque no tenga máquina). Ej: "offset". */
  tecnologiaTercerizado?: string | null;
  /** Costo total del paso (tiempo + materiales + cargos, o costo tercerizado). */
  costoTotal: number;
  /** Outputs canónicos que el paso escribió al JobContext. */
  outputsCanonicos?: Record<string, unknown>;
  /**
   * B.3.2 — Los outputs proyectados al Registro de Capacidades (vista
   * estandarizada, aditiva: las keys planas siguen siendo la fuente para
   * los lectores legacy). Ver `productos-servicios/pasos/capacidades.ts`.
   */
  capacidades?: CapacidadEmitida[];
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
    | 'secuencial-rollo'
    | 'grid-2d-single'
    | 'grid-2d-multi'
    | 'packingsolver-rectangle';
  /** Cantidad calculada en su unidad (m_lineales, pliegos, pouches, m2, piezas). */
  cantidadCalculada: number;
  unidad: 'm_lineales' | 'pliegos' | 'pouches' | 'm2' | 'piezas';
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
  piezasPorPouch?: number;
  consumedLengthMm?: number;
  piezasAcomodadas: number;
  /** Datos normalizados para que el SVG muestre cómo pensó el motor. */
  visualConfig?: NestingVisualConfig;
  /** Outputs canónicos publicados por el paso que generó este nesting. */
  outputsCanonicos?: Record<string, unknown>;
  /** Overlay/resumen del costeo de sustrato asociado al nesting. */
  costingPreview?: NestingCostingPreview;
  /** Selección automática de pliego, cuando el paso evaluó candidatos. */
  pliegoImpresionSeleccionado?: {
    id: string;
    nombre: string;
    anchoMm: number;
    altoMm: number;
    criterio: string;
    candidatosEvaluados: number;
    /** Área comprada (mm²) en 'menor_costo_sustrato'; $ en 'menor_costo_real'. */
    costoEstimadoMm2: number;
    pliegosImpresion: number;
    pliegosComprados: number;
    aprovechamientoPct: number;
    /** Origen de costo 'por_candidato': MP propia del candidato ganador. */
    materiaPrima?: {
      varianteId: string;
      sku: string;
      nombre: string;
      precioReferencia: number | null;
    };
  };
  /** v3.1: solo cuando se aplicó talonario-grouping (post-nesting). */
  talonarioGrouping?: {
    talonariosEfectivos: number;
    talonariosPedidos: number;
    posesXPliego: number;
    talonariosPorGrupo: number;
    gruposCompletos: number;
    talonariosResiduo: number;
    pliegosXCapa: number;
    /** Pilas que se abrochan/cortan juntas (base de insumos por pila). */
    pilas: number;
    posesDesperdicio: number;
    numerosXTalonario: number;
    modoIncompleto: string;
  };
}

/**
 * Geometría del acomodo, en TRES niveles concéntricos. Confundirlos ya costó
 * caro (el simulador acomodaba con márgenes que no eran los del motor), así
 * que conviene tenerlos claros:
 *
 *   substrato            600 mm  ── el rollo/pliego entero
 *   └ printableArea      570 mm  ── adentro del margen de MÁQUINA
 *     └ usableArea       565 mm  ── adentro también de la demasía: acá van
 *                                   las piezas de verdad
 *
 * `margins` es el margen CRUDO de máquina (15), NO incluye la demasía. Quien
 * necesite el borde efectivo donde arrancan las piezas usa `usableArea`, o
 * suma `pieceBleedMm` (así lo hace `acomodarTanda` del simulador). Se reportan
 * separados porque la UI los muestra como dos cosas distintas.
 */
export interface NestingVisualConfig {
  /** Margen de máquina, SIN la demasía. Ver el diagrama de arriba. */
  margins: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;
  };
  /** Separación entre piezas vecinas (= pieceBleedMm × 2). */
  spacing: {
    horizontalMm: number;
    verticalMm: number;
  };
  /** Demasía por lado de cada pieza. */
  pieceBleedMm?: number;
  allowRotation: boolean;
  substrateLabel?: string;
  centerPlacements?: boolean;
  /** Adentro del margen de máquina Y de la demasía: donde van las piezas. */
  usableArea: {
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
  };
  /** Adentro del margen de máquina solamente. */
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
  slotNombre?: string | null;
  slotRol?: string | null;
  materialVarianteId: string;
  /** Compatibilidad histórica: antes era el SKU. Se mantiene sin cambios. */
  materialNombre: string;
  materialSku: string;
  materialDisplayName: string;
  materiaPrimaNombre?: string | null;
  materiaPrimaTemplateId?: string | null;
  materiaPrimaTipoTecnico?: string | null;
  atributosVarianteJson?: Record<string, unknown> | null;
  tipoLineaCosto: 'MATERIAL' | 'CONSUMIBLE_MAQUINA' | 'DESGASTE_MAQUINA';
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
    | 'MAQUINA_CONSUMIBLE'
    | 'MAQUINA_DESGASTE';
}

export interface CargoDirectoEjecutado {
  cargoDirectoCatalogoId: string;
  cargoCodigo: string;
  cargoNombre: string;
  modoCalculo:
    'MONTO_FIJO_PLANO' | 'PORCENTAJE_SOBRE_BASE' | 'POR_UNIDAD_INPUT';
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
  modoMedidas: 'FIJA' | 'LIBRE' | 'COMERCIAL_ELIGE' | 'MIXTA';
  minimoComercialPolitica: string;
  minimoComercialCantidad: number | null;
  minimoComercialBase: string;
  /**
   * Medida default del producto (FIJA, COMERCIAL_ELIGE o MIXTA). Cuando
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

/**
 * E.1 — Defaults declarados de la familia (FamiliaPasoDefaults): el motor
 * los aplica como fallback VIVO cuando la config del producto dejó el
 * campo vacío. Ver docs/wizard-ruta-diseno.md §2.
 */
export interface DefaultsFamiliaPaso {
  centroCostoId: string | null;
  centroCostoCodigo: string | null;
  centroCostoNombre: string | null;
  productividadHora: number | null;
  tiempoFijoMin: number | null;
  demasiaMm: number | null;
  solapePanelMm: number | null;
}

export interface PasoCargado {
  rutaPasoId: string;
  rutaPasoOrden: number;
  familiaCodigo: string;
  nombreVisible?: string | null;
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
  /** Operarios que ocupa el paso; multiplica el costo de mano de obra. */
  dotacionOperarios?: number | null;
  /**
   * `rutaPasoId` de los pasos que este paso NECESITA: al activarse los
   * enciende aunque sean OPCIONALES. Ver `arrastre-opcionales.ts`.
   */
  requiereRutaPasoIds?: string[];
  /** === Tercerización (docs/productos-tercerizados-diseno.md) === */
  tercerizado?: boolean;
  proveedorId?: string | null;
  /** 'tarifa_magnitud' | 'matriz' | 'fijo'. */
  fuenteCostoTercerizado?: string | null;
  tercerizadoConfigJson?: unknown;
  plazoProveedorDias?: number | null;
  /** Filas de la matriz (sólo fuente 'matriz'), con costo ya en number. */
  tercerizadoEntradas?: Array<{
    claveMatch: string;
    valoresJson: unknown;
    cantidad: number;
    costo: number;
  }>;
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
    componentesDesgaste?: ComponenteDesgasteCargado[];
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
    feedReloadMin?: number | null;
    detalleJson?: unknown;
  };
  /** Centro de costo manual para pasos sin máquina. */
  centroCosto?: {
    id: string;
    codigo: string;
    nombre: string;
  };
  /** E.1 — defaults declarados de la familia (fallback vivo del motor). */
  defaultsFamilia?: DefaultsFamiliaPaso;
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
    perfilDefaultId?: string | null;
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
      componentesDesgaste?: ComponenteDesgasteCargado[];
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
      feedReloadMin?: number | null;
      detalleJson: unknown;
    }>;
    perfilDefault?: {
      id: string;
      nombre: string;
      tipoPerfil?: string | null;
      activo: boolean;
      productivityValue: number | null;
      productivityUnit: string | null;
      setupMin: number | null;
      cleanupMin: number | null;
      feedReloadMin?: number | null;
      detalleJson: unknown;
    } | null;
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
    feedReloadMin?: number | null;
    detalleJson: unknown;
  }>;
  slots: SlotCargado[];
  /** Cargos directos a nivel PASO declarados por el producto (G-M3). */
  cargosDirectosPaso: CargoPasoCargado[];
}

/**
 * Pieza que se gasta con el uso de la máquina. El costo se prorratea por
 * clicks A4-equivalentes. Ver docs/costo-por-click-desgaste-diseno.md
 */
export interface ComponenteDesgasteCargado {
  id: string;
  nombre: string;
  tipo: string;
  vidaUtilEstimada: number | null;
  unidadDesgaste: string;
  /** Precio suelto, para el repuesto que no está dado de alta en inventario. */
  precioUnitario: number | null;
  /** La pieza sólo gira imprimiendo en color (drums/reveladores CMY). */
  soloColor: boolean;
  activo: boolean;
  materiaPrimaVarianteId: string | null;
  materiaPrimaVariante?: {
    id: string;
    sku: string;
    precioReferencia: number | null;
  } | null;
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
    materiaPrimaTemplateId?: string | null;
    materiaPrimaTipoTecnico?: string | null;
    precioReferencia: number | null;
    unidadStock?: string | null;
    atributosVarianteJson?: Record<string, unknown> | null;
  };
}

export interface SlotCargado {
  id: string;
  slotCodigo: string;
  slotNombre?: string | null;
  slotRol?: string | null;
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
  cantidadFactor?: number | string | null;
  cantidadBase?: string | null;
  aplicaMultiCaras: boolean;
  /** Material concreto si HARDCODED (o el resuelto en runtime). */
  materialVariante?: {
    id: string;
    sku: string;
    nombreVariante?: string | null;
    materiaPrimaNombre?: string | null;
    materiaPrimaTemplateId?: string | null;
    materiaPrimaTipoTecnico?: string | null;
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
