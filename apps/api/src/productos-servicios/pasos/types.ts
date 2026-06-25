/**
 * Tipos y estructuras del catálogo de FAMILIAS de paso.
 *
 * Una FAMILIA es un tipo declarativo de paso que un modelador puede usar
 * al armar una ruta de producción. El catálogo de familias es CERRADO en
 * código (no en DB) — modificar requiere deploy.
 *
 * Ver `docs/motor-por-pasos-analisis/01-tipos-de-paso.md` para la justificación
 * conceptual.
 */

// ============================================================================
// Códigos de familias (catálogo cerrado)
// ============================================================================

export type FamiliaCodigo =
  // Pre-prensa
  | 'pre_prensa'
  | 'proof'
  // Producción / impresión
  | 'impresion_por_hoja'
  | 'impresion_por_area'
  | 'impresion_por_pieza'
  | 'aplicacion_transfer'
  | 'grabado_laser'
  // Corte y formado
  | 'corte_guillotina'
  | 'plotter_corte'
  | 'corte_laser'
  | 'troquelado_digital'
  | 'cnc'
  | 'plegado'
  | 'perforado'
  | 'corte_manual' // [Fase E]
  // Terminaciones
  | 'laminado'
  | 'plastificado_pouch'
  | 'barniz'
  | 'acabado_decorativo'
  | 'pintura_superficial'
  | 'lijado_canteado' // [Fase E]
  // Encuadernación / armado
  | 'encuadernado_engrapado'
  | 'encuadernado_anillado'
  | 'engomado_emblocado'
  | 'armado_cajas'
  // Estructural / montaje
  | 'soldadura'
  | 'montaje_sobre_sustrato'
  | 'ensamble_estructural'
  | 'instalacion_electrica'
  // Operaciones manuales
  | 'embalaje'
  | 'conteo_manual'
  | 'atado_banding'
  | 'etiquetado_manual'
  | 'control_calidad'
  | 'trabajo_manual'
  // Modificaciones físicas (sub-categoría dentro de manuales)
  | 'modificacion_pre'
  | 'modificacion_post'
  // Logística / instalación
  | 'envio'
  | 'instalacion_in_situ'
  | 'toma_medidas'
  // Servicios profesionales
  | 'diseno_grafico';

// ============================================================================
// Categorías de alto nivel
// ============================================================================

export type CategoriaFamiliaCodigo =
  | 'pre_prensa'
  | 'produccion_impresion'
  | 'corte_y_formado'
  | 'terminaciones'
  | 'encuadernacion_armado'
  | 'estructural_montaje'
  | 'operaciones_manuales'
  | 'logistica_instalacion'
  | 'servicios_profesionales';

// ============================================================================
// Comportamiento de la familia
// ============================================================================

/** Relación de la familia con máquinas:
 *  - 'M-0' = sin máquina industrial (manual o herramienta auxiliar)
 *  - 'M-1' = máquina única (modelador asigna máquina específica al armar producto)
 *  - 'M-2' = alternativas de tecnología (modelador declara candidatas, comercial elige)
 */
export type RelacionMaquina = 'M-0' | 'M-1' | 'M-2';

/** Origen del tiempo del paso. Ver D.4 + Fase B.
 *  - T-1 INTERVIENE_FIJO: el modelador define un tiempo fijo (ej: diseño $X horas).
 *  - T-2 PRODUCTIVIDAD_PROPIA: el paso tiene su propia productividad (ej: embalaje 50 cajas/h).
 *  - T-3 PRODUCTIVIDAD_PERFIL: viene del perfil de la máquina elegida.
 *  - T-4 INPUT_MANUAL_COMERCIAL: el comercial carga el tiempo al cotizar (ej: corte láser custom).
 */
export type ModoTiempo = 'T-1' | 'T-2' | 'T-3' | 'T-4';

/** Cómo se decide la cantidad a producir en el paso. Ver D.3. */
export type MecanismoCantidad =
  | 'DIRECT_FROM_JOBCONTEXT' // lee directo un campo del JobContext
  | 'HEREDAR_DEL_OUTPUT_CANONICO' // lee output que escribió un paso anterior
  | 'CALCULADO_POR_PASO' // el paso ejecuta su propio cálculo (típicamente nesting)
  | 'CONVERSION'; // aplica fórmula a otro valor

/** Modos de activación. Ver D.1. */
export type ModoActivacion =
  | 'OBLIGATORIO'
  | 'OPCIONAL'
  | 'CONDICIONAL'
  | 'NO_EJECUTAR';

export const MODOS_ACTIVACION_UNIVERSALES: ModoActivacion[] = [
  'OBLIGATORIO',
  'OPCIONAL',
  'CONDICIONAL',
  'NO_EJECUTAR',
];

// ============================================================================
// Slots de materiales (declarados por la familia)
// ============================================================================

export type TipoSlot =
  | 'SUSTRATO' // sustrato principal (papel, vinilo, MDF, etc.)
  | 'CONSUMIBLE_MAQUINA' // consumible vinculado a la máquina (tinta, tóner, film)
  | 'INSUMO_PASO' // insumo específico del paso (cola, broches, anillos)
  | 'TAPA' // tapas / cubiertas
  | 'OTRO';

export type FamiliaMateriaPrimaCompat =
  | 'SUSTRATO'
  | 'TINTA_COLORANTE'
  | 'TRANSFERENCIA_LAMINACION'
  | 'QUIMICO_AUXILIAR'
  | 'ADITIVA_3D'
  | 'ELECTRONICA_CARTELERIA'
  | 'NEON_LUMINARIA'
  | 'METAL_ESTRUCTURA'
  | 'PINTURA_RECUBRIMIENTO'
  | 'TERMINACION_EDITORIAL'
  | 'MAGNETICO_FIJACION'
  | 'POP_EXHIBIDOR'
  | 'HERRAJE_ACCESORIO'
  | 'ADHESIVO_TECNICO'
  | 'PACKING_INSTALACION';

export type SubfamiliaMateriaPrimaCompat =
  | 'SUSTRATO_HOJA'
  | 'SUSTRATO_ROLLO_FLEXIBLE'
  | 'SUSTRATO_RIGIDO'
  | 'OBJETO_PROMOCIONAL_BASE'
  | 'TINTA_IMPRESION'
  | 'TONER'
  | 'FILM_TRANSFERENCIA'
  | 'PAPEL_TRANSFERENCIA'
  | 'LAMINADO_FILM'
  | 'LAMINADO_POUCH'
  | 'QUIMICO_ACABADO'
  | 'AUXILIAR_PROCESO'
  | 'POLVO_DTF'
  | 'FILAMENTO_3D'
  | 'RESINA_3D'
  | 'MODULO_LED_CARTELERIA'
  | 'FUENTE_ALIMENTACION_LED'
  | 'CABLEADO_CONECTICA'
  | 'CONTROLADOR_LED'
  | 'NEON_FLEX_LED'
  | 'ACCESORIO_NEON_LED'
  | 'CHAPA_METALICA'
  | 'PERFIL_ESTRUCTURAL'
  | 'PINTURA_CARTELERIA'
  | 'PRIMER_SELLADOR'
  | 'ANILLADO_ENCUADERNACION'
  | 'TAPA_ENCUADERNACION'
  | 'IMAN_CERAMICO_FLEXIBLE'
  | 'FIJACION_AUXILIAR'
  | 'ACCESORIO_EXHIBIDOR_CARTON'
  | 'ACCESORIO_MONTAJE_POP'
  | 'SEMIELABORADO_POP'
  | 'ARGOLLA_LLAVERO_ACCESORIO'
  | 'OJAL_OJALILLO_REMACHE'
  | 'PORTABANNER_ESTRUCTURA'
  | 'SISTEMA_COLGADO_MONTAJE'
  | 'PERFIL_BASTIDOR_TEXTIL'
  | 'CINTA_DOBLE_FAZ_TECNICA'
  | 'ADHESIVO_LIQUIDO_ESTRUCTURAL'
  | 'VELCRO_CIERRE_TECNICO'
  | 'EMBALAJE_PROTECCION'
  | 'ETIQUETADO_IDENTIFICACION'
  | 'CONSUMIBLE_INSTALACION';

export interface CompatibilidadMaterialSlot {
  familiasMateriaPrima?: FamiliaMateriaPrimaCompat[];
  subfamiliasMateriaPrima?: SubfamiliaMateriaPrimaCompat[];
  templateIds?: string[];
  tipoTecnico?: string[];
}

export interface SlotDeclarado {
  /** Código único del slot dentro de la familia. */
  codigo: string;
  /** Nombre humano del slot (para UI). */
  nombre: string;
  /** Tipo de material esperado en este slot. */
  tipo: TipoSlot;
  /** Si es true, el modelador DEBE llenar el slot. Si false, es opcional. */
  requerido: boolean;
  /** Filtro técnico de materias primas permitidas para este slot. */
  compatibilidadMaterial?: CompatibilidadMaterialSlot;
}

// ============================================================================
// Validaciones declaradas por la familia (D.7 - Tipo B + C)
// ============================================================================

export type TipoValidacion =
  | 'REQUIRES_INPUT' // el JobContext debe tener un campo no-null
  | 'COMPARE' // compara dos valores (operador <=, >=, ==, etc.)
  | 'IN_RANGE' // un valor debe estar entre min y max
  | 'ONE_OF' // un valor debe pertenecer a una lista
  | 'EXISTS_OUTPUT'; // un output canónico debe haber sido escrito por algún paso anterior

export interface ValidacionDeclaradaBase {
  /** Código único de la validación. */
  codigo: string;
  /** Mensaje al fallar (puede tener {placeholders} con valores del contexto). */
  mensaje: string;
}

export interface ValidacionRequiresInput extends ValidacionDeclaradaBase {
  tipo: 'REQUIRES_INPUT';
  campo: string; // campo del JobContext
}

export interface ValidacionCompare extends ValidacionDeclaradaBase {
  tipo: 'COMPARE';
  campoJobContext: string;
  fuenteB: 'JOBCONTEXT' | 'MAQUINA' | 'MATERIAL' | 'CONFIG_PASO';
  campoB: string;
  operador: '<=' | '>=' | '==' | '!=' | '<' | '>';
  /** Si fuenteB = MATERIAL, qué slot mirar. */
  slotMaterial?: string;
}

export interface ValidacionInRange extends ValidacionDeclaradaBase {
  tipo: 'IN_RANGE';
  campo: string;
  min?: number;
  max?: number;
}

export interface ValidacionOneOf extends ValidacionDeclaradaBase {
  tipo: 'ONE_OF';
  campo: string;
  valoresPermitidos: string[];
}

export interface ValidacionExistsOutput extends ValidacionDeclaradaBase {
  tipo: 'EXISTS_OUTPUT';
  outputCanonico: string;
}

export type ValidacionDeclarada =
  | ValidacionRequiresInput
  | ValidacionCompare
  | ValidacionInRange
  | ValidacionOneOf
  | ValidacionExistsOutput;

// ============================================================================
// paramsPaso schema (qué params soporta el modelador en el paso del producto)
// ============================================================================

export type TipoParamsPaso = 'string' | 'number' | 'boolean' | 'enum';

export interface ParamsPasoDeclarado {
  /** Nombre del campo en el JSON paramsPaso. */
  campo: string;
  /** Etiqueta humana (para UI). */
  etiqueta: string;
  /** Tipo del valor. */
  tipo: TipoParamsPaso;
  /** Si tipo = 'enum', valores permitidos. */
  valoresPermitidos?: string[];
  /** Valor por defecto. */
  default?: unknown;
  /** Si es requerido (false = opcional, default = false). */
  requerido?: boolean;
  /** Descripción para documentación / tooltip. */
  descripcion?: string;
}

// ============================================================================
// Definición completa de una familia
// ============================================================================

export interface DefinicionFamilia {
  // --- Identidad ---
  codigo: FamiliaCodigo;
  nombre: string;
  categoria: CategoriaFamiliaCodigo;
  descripcion?: string;
  /** Si false, queda disponible para productos existentes pero no aparece al crear pasos nuevos. */
  visibleEnSelector?: boolean;

  // --- Comportamiento ---
  /** Tipos de relación máquina soportados. La mayoría tiene una sola, algunas pueden ser ['M-1', 'M-2'] o ['M-0', 'M-1']. */
  relacionMaquinaSoportada: RelacionMaquina[];
  /** Modos de tiempo que la familia soporta. El modelador habilita un subset al armar producto. */
  modosTiempoSoportados: ModoTiempo[];
  /** Mecanismos de cantidad soportados. Si lista 1 solo, no hay decisión del modelador. */
  mecanismosCantidadSoportados: MecanismoCantidad[];
  /** Modos de activación soportados. Casi todas soportan los 3. */
  modosActivacionSoportados: ModoActivacion[];
  /** Modo de activación default (cuando el modelador no especifica). */
  modoActivacionDefault: ModoActivacion;
  /** Multiplicadores que el run del paso puede usar. Ej: ['caras', 'tipoCopia']. */
  multiplicadoresSoportados: string[];

  // --- Materiales ---
  /** Slots de materiales que la familia declara (algunos requeridos, otros opcionales). */
  slotsRequeridos: SlotDeclarado[];
  /** Si el modelador puede agregar slots adicionales fuera de los declarados. */
  permiteSlotsAdicionales: boolean;

  // --- Plantillas de máquinas compatibles (cuando relacionMaquina != M-0) ---
  /** Códigos de plantillas (enum PlantillaMaquinaria) compatibles. Vacío si M-0. */
  plantillasCompatibles: string[];

  // --- Inputs / outputs ---
  /** Inputs del JobContext que la familia necesita (validaciones REQUIRES_INPUT van encima). */
  inputsRequeridos: string[];
  /** Outputs canónicos que el paso escribe al JobContext. */
  outputsCanonicos: string[];

  // --- Validaciones (D.7) ---
  validaciones: ValidacionDeclarada[];

  // --- paramsPaso schema (D.4 + H19) ---
  /** Lista de params custom que el modelador puede llenar al configurar el paso del producto. */
  paramsPasoSchema: ParamsPasoDeclarado[];

  // --- Productos / aplicación ---
  /** Productos típicos donde aplica la familia (informativo, para UI). */
  productosTipicos?: string[];
}
