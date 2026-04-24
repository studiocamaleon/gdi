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
  /** Costos por bucket (a-g del molde). */
  costos: {
    tiempoTotal: number;
    materialesTotal: number;
    cargosDirectosTotal: number;
    total: number;
    unitario: number;
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
}

export interface MaterialEjecutado {
  slotCodigo: string;
  materialVarianteId: string;
  materialNombre: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  costoTotal: number;
  /** Estrategia usada (simple, m2-exact, etc.). */
  estrategiaCosto: string;
  /** Modo de selección que se aplicó. */
  modoSeleccion: 'HARDCODED' | 'COMERCIAL_ELIGE' | 'MOTOR_ELIGE_AUTO';
}

export interface CargoDirectoEjecutado {
  cargoDirectoCatalogoId: string;
  cargoCodigo: string;
  cargoNombre: string;
  modoCalculo: 'MONTO_FIJO_PLANO' | 'PORCENTAJE_SOBRE_BASE' | 'POR_UNIDAD_INPUT';
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
  setupOverrideMin: number | null;
  cleanupOverrideMin: number | null;
  tiempoFijoOverrideMin: number | null;
  /** Detalles de la máquina (cargados del JOIN). */
  maquina?: {
    id: string;
    codigo: string;
    nombre: string;
    plantilla: string;
    centroCostoPrincipalId?: string | null;
    parametrosTecnicosJson?: Record<string, unknown> | null;
  };
  /** Detalles del perfil (cargados del JOIN). */
  perfil?: {
    id: string;
    nombre: string;
    productivityValue: number | null;
    productivityUnit: string | null;
    setupMin: number | null;
    cleanupMin: number | null;
  };
  /** Otros perfiles disponibles de la máquina M-1 (para selección automática). */
  perfilesDisponibles?: Array<{
    id: string;
    nombre: string;
    activo: boolean;
    productivityValue: number | null;
    setupMin: number | null;
    cleanupMin: number | null;
    detalleJson: unknown;
  }>;
  slots: SlotCargado[];
}

export interface SlotCargado {
  id: string;
  slotCodigo: string;
  modoSeleccion: string;
  criterioMotorAuto?: string | null;
  criterioInputCampo?: string | null;
  criterioMaterialCampo?: string | null;
  materialVarianteId: string | null;
  materialesCandidatosJson: unknown;
  estrategiaCosto: string;
  formula: string;
  aplicaMultiCaras: boolean;
  /** Material concreto si HARDCODED (o el resuelto en runtime). */
  materialVariante?: {
    id: string;
    sku: string;
    precioReferencia: number | null;
    atributosVarianteJson?: Record<string, unknown> | null;
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
