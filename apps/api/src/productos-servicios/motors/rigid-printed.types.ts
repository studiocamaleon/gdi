/**
 * Tipos para el motor de rígidos impresos (rigidos_impresos@1).
 *
 * Productos de sustrato rígido + impresión (PVC Impreso, MDF Impreso, etc.)
 * Un producto = un material rígido.
 * Dos tipos de impresión: directa (UV cama plana) o sustrato flexible montado.
 * Config almacenada como JSON en ProductoMotorConfig.parametrosJson.
 */

// ── Enums ─────────────────────────────────────────────────────────

export type TipoImpresionRigido = 'directa' | 'flexible_montado';

export type EstrategiaCosteoMaterial =
  | 'm2_exacto'
  | 'largo_consumido'
  | 'segmentos_placa';

export type PrioridadNesting =
  | 'rigido_manda'
  | 'flexible_manda'
  | 'independientes';

export type ModoMedidas = 'estandar' | 'libres' | 'ambas';

// ── Sub-configs ───────────────────────────────────────────────────

export type ImpresionTipoConfig = {
  maquinasCompatibles: string[];
  perfilesCompatibles: string[];
  maquinaDefaultId: string | null;
  perfilDefaultId: string | null;
};

export type ImposicionConfig = {
  estrategiaCosteo: EstrategiaCosteoMaterial;
  /** Escalones para costeo por segmentos (ej: [25, 50, 75, 100]) */
  segmentosPlaca: number[];
  separacionHorizontalMm: number;
  separacionVerticalMm: number;
  margenPlacaMm: number;
  permitirRotacion: boolean;
  /** Prioridad cuando hay rígido + flexible montado */
  prioridadNesting: PrioridadNesting;
};

// ── Config raíz del motor ─────────────────────────────────────────

export type RigidPrintedMotorConfig = {
  tipoPlantilla: 'rigidos_impresos';

  // Tipos de impresión habilitados
  tiposImpresion: TipoImpresionRigido[];

  // Config por tipo de impresión
  impresionDirecta: ImpresionTipoConfig;
  flexibleMontado: ImpresionTipoConfig;

  // Rutas de producción por tipo de impresión
  rutaImpresionDirectaId: string | null;
  rutaFlexibleMontadoId: string | null;

  // Material rígido (1 solo por producto)
  materialRigidoId: string | null;
  /** IDs de MateriaPrimaVariante activas para este producto */
  variantesCompatibles: string[];
  placaVarianteIdDefault: string | null;

  // Caras
  carasDisponibles: ('simple_faz' | 'doble_faz')[];
  carasDefault: 'simple_faz' | 'doble_faz';

  // Modo de medidas
  modoMedidas: ModoMedidas;

  // Imposición
  imposicion: ImposicionConfig;
};

// ── Defaults ──────────────────────────────────────────────────────

export const DEFAULT_IMPOSICION_CONFIG: ImposicionConfig = {
  estrategiaCosteo: 'segmentos_placa',
  segmentosPlaca: [25, 50, 75, 100],
  separacionHorizontalMm: 3,
  separacionVerticalMm: 3,
  margenPlacaMm: 5,
  permitirRotacion: true,
  prioridadNesting: 'rigido_manda',
};

export const DEFAULT_IMPRESION_TIPO_CONFIG: ImpresionTipoConfig = {
  maquinasCompatibles: [],
  perfilesCompatibles: [],
  maquinaDefaultId: null,
  perfilDefaultId: null,
};

export const DEFAULT_RIGID_PRINTED_CONFIG: RigidPrintedMotorConfig = {
  tipoPlantilla: 'rigidos_impresos',
  tiposImpresion: [],
  impresionDirecta: { ...DEFAULT_IMPRESION_TIPO_CONFIG },
  flexibleMontado: { ...DEFAULT_IMPRESION_TIPO_CONFIG },
  rutaImpresionDirectaId: null,
  rutaFlexibleMontadoId: null,
  materialRigidoId: null,
  variantesCompatibles: [],
  placaVarianteIdDefault: null,
  carasDisponibles: ['simple_faz'],
  carasDefault: 'simple_faz',
  modoMedidas: 'estandar',
  imposicion: { ...DEFAULT_IMPOSICION_CONFIG },
};

// ── Plantillas de máquina por tipo ────────────────────────────────

/** Máquinas que pueden imprimir directo sobre sustrato rígido */
export const PLANTILLAS_IMPRESION_DIRECTA = [
  'IMPRESORA_UV_MESA_EXTENSORA',
  'IMPRESORA_UV_FLATBED',
] as const;

/** Máquinas para imprimir sustrato flexible (que luego se monta) */
export const PLANTILLAS_FLEXIBLE_MONTADO = [
  'IMPRESORA_UV_ROLLO',
  'IMPRESORA_SOLVENTE',
  'IMPRESORA_LATEX',
  'IMPRESORA_INYECCION_TINTA',
  'IMPRESORA_SUBLIMACION_GRAN_FORMATO',
  'PLOTTER_DE_CORTE',
] as const;
