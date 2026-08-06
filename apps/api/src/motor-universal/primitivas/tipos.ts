/**
 * Contratos de las PRIMITIVAS de familia (docs/primitivas-de-familia-diseno.md).
 *
 * Una primitiva es un algoritmo propio del oficio de una familia (cómo
 * calcula su tiempo, su cantidad, su desgaste…), mudado del cuerpo del motor
 * a este catálogo. La ficha declara cuáles usa en el eje `primitivas`; el
 * motor busca por nombre en los registros de `index.ts` y ejecuta.
 *
 * `deps` es el puente con el motor: cada gancho recibe SOLO los callbacks
 * que su contrato pide (no el motor entero) — mismo espíritu que el
 * `materialPrincipal` de los derivadores.
 *
 * P1: ganchos `tiempoRun` y `cantidadPropia`. P2-P4 agregan factorVelocidad,
 * desgaste, compraSustrato, seleccionPerfil y avisos.
 */
import type { ErrorMotor, JobContext, PasoCargado } from '../tipos';
import type { NestingDispatchResult } from '../nesting-dispatcher';

// ─── tiempoRun ──────────────────────────────────────────────────────
/** Callbacks del motor disponibles para una primitiva de tiempo. */
export interface DepsTiempoRun {
  /** La cantidad efectiva del paso (mecanismo configurado, sin nesting). */
  resolverCantidad: (paso: PasoCargado, jobContext: JobContext) => number;
}

/**
 * T-3 con algoritmo propio: devuelve el run en MINUTOS. El paso que declara
 * este gancho NO pasa por productividad×cantidad del perfil.
 */
export type PrimitivaTiempoRun = (
  paso: PasoCargado,
  jobContext: JobContext,
  deps: DepsTiempoRun,
) => number;

// ─── cantidadPropia ─────────────────────────────────────────────────
export interface DepsCantidadPropia {
  /** Params del paso con los overrides del comercial ya aplicados. */
  paramsEfectivos: (
    paso: PasoCargado,
    jobContext: JobContext,
  ) => Record<string, unknown>;
}

/**
 * CALCULADO_POR_PASO sin nesting ni derivador: la cantidad del paso sale de
 * un cálculo propio (los ml de costura de una modificación física).
 */
export type PrimitivaCantidadPropia = (
  paso: PasoCargado,
  jobContext: JobContext,
  deps: DepsCantidadPropia,
) => number;

// ─── factorVelocidad ────────────────────────────────────────────────
/**
 * Multiplicador (≥1) de la velocidad del perfil según el trabajo: una PPM
 * declarada en páginas A4 rinde menos páginas por pliego grande. El motor lo
 * pide sólo cuando la unidad de productividad lo amerita (PPM); sin
 * declaración el factor es 1.
 */
export type PrimitivaFactorVelocidad = (
  paso: PasoCargado,
  jobContext: JobContext,
  nestingDispatch: NestingDispatchResult | null,
) => number;

// ─── desgaste ───────────────────────────────────────────────────────
export interface DepsDesgaste {
  /** Cantidad efectiva del paso (con nesting si aplica). */
  resolverCantidad: (
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
  ) => number;
  /** Caras que consumen (doble faz efectiva del paso). */
  carasConsumible: (paso: PasoCargado, jobContext: JobContext) => number;
  /** El factor de velocidad declarado del propio paso (1 si no declara). */
  factorVelocidad: (
    paso: PasoCargado,
    jobContext: JobContext,
    nestingDispatch: NestingDispatchResult | null,
  ) => number;
}

/**
 * Unidades de desgaste (clicks) que el paso consume de los componentes de la
 * máquina. Familias sin este gancho no clickean.
 */
export type PrimitivaDesgaste = (
  paso: PasoCargado,
  jobContext: JobContext,
  nestingDispatch: NestingDispatchResult | null,
  deps: DepsDesgaste,
) => number;

// ─── seleccionPerfil ────────────────────────────────────────────────
/** Un perfil operativo tal como lo carga el motor. */
export type PerfilDisponible = NonNullable<
  PasoCargado['perfilesDisponibles']
>[number];

export interface DepsSeleccionPerfil {
  /** Caras efectivas del paso (señal del comercial u override). */
  carasEfectivas: (paso: PasoCargado, jobContext: JobContext) => number;
  /** ¿El perfil es de doble faz? */
  perfilEsDobleFaz: (perfil: PerfilDisponible) => boolean;
  /** Escalón de gramaje: el "hasta" más chico que todavía cubre el papel
   *  (helper genérico del motor — guillotina y hoja lo comparten). */
  elegirPorEscalonDeGramaje: (
    candidatos: PerfilDisponible[],
    gramaje: number,
  ) => PerfilDisponible | null | undefined;
  numeroPositivo: (value: unknown) => number | undefined;
}

/**
 * Selección de perfil propia del oficio. Recibe los candidatos YA filtrados
 * por modo de color (ese filtro es del motor, genérico) y devuelve:
 *  - un perfil → decisión tomada (si es el actual, el motor lo deja);
 *  - null → SIN decisión: el motor sigue su pipeline (reglas declarativas).
 */
export type PrimitivaSeleccionPerfil = (
  paso: PasoCargado,
  jobContext: JobContext,
  candidatos: PerfilDisponible[],
  deps: DepsSeleccionPerfil,
) => PerfilDisponible | null;

// ─── compraSustrato ─────────────────────────────────────────────────
/**
 * Convierte el consumo del slot en unidades de COMPRA del material (pliegos
 * de impresión → hojas comerciales). Devuelve la cantidad original cuando la
 * conversión no aplica.
 */
export type PrimitivaCompraSustrato = (
  cantidadConsumo: number,
  slotCodigo: string,
  paso: PasoCargado,
  jobContext: JobContext,
  nestingDispatch: NestingDispatchResult | null,
  materialResuelto: {
    unidadStock?: string | null;
    atributosVarianteJson?: Record<string, unknown> | null;
  },
) => number;

// ─── avisos ─────────────────────────────────────────────────────────
export interface DepsAviso {
  carasEfectivas: (paso: PasoCargado, jobContext: JobContext) => number;
  /** Acepta cualquier perfil con nombre+detalle (el resuelto no trae
   *  `activo`), igual que el helper del motor. */
  perfilEsDobleFaz: (perfil: {
    nombre: string;
    detalleJson?: unknown;
  }) => boolean;
  /** Perfiles activos y compatibles con la familia del paso. */
  perfilesCompatibles: (paso: PasoCargado) => PerfilDisponible[];
}

/**
 * Diagnóstico propio del oficio: agrega WARNINGS a la cotización (nunca
 * corta). La familia declara una LISTA (`primitivas.avisos`); el motor los
 * corre todos tras resolver el perfil.
 */
export type PrimitivaAviso = (
  paso: PasoCargado,
  jobContext: JobContext,
  perfilResuelto: NonNullable<PasoCargado['perfil']> | null,
  errores: ErrorMotor[],
  deps: DepsAviso,
) => void;
