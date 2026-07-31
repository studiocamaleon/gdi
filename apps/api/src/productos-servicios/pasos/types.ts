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
  | 'colocacion_ojales'
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

/** Cómo se registra el trabajo del paso en el tablero de producción
 *  (registro-tiempos-produccion D1):
 *  - 'cronometro': domina la mano de obra — Iniciar→Pausar/Continuar→Completar
 *    con tramos medidos.
 *  - 'solo_completar': domina el runtime de máquina (tandas consolidadas) —
 *    un click y el tiempo asentado es el estimado del motor.
 */
export type ModoRegistroPaso = 'cronometro' | 'solo_completar';

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
  | 'PACKING_INSTALACION'
  | 'SELLOS';

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
  | 'COMPONENTE_EDITORIAL'
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
  | 'TEXTIL_INDUMENTARIA'
  | 'CINTA_DOBLE_FAZ_TECNICA'
  | 'ADHESIVO_LIQUIDO_ESTRUCTURAL'
  | 'VELCRO_CIERRE_TECNICO'
  | 'EMBALAJE_PROTECCION'
  | 'ETIQUETADO_IDENTIFICACION'
  | 'CONSUMIBLE_INSTALACION'
  | 'SELLOS_AUTOMATICOS'
  | 'SELLOS_MANUALES'
  | 'GOMA_LASERABLE'
  | 'ALMOHADILLA_TINTA';

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
  /** Fórmula de consumo que este slot IMPONE, ignorando lo que configure el
   *  modelador (ej: el film de laminado siempre es `por_metro_lineal` porque
   *  su nesting calcula metros). Si se omite, vale lo configurado o el
   *  default `por_unidad_productiva`. [Etapa A: era un if en config-pasos] */
  formulaForzada?: string;
  /** El costeo del material de este slot NO multiplica por caras aunque el
   *  paso las soporte (ej: el sustrato de impresión por hoja — los pliegos
   *  del nesting ya contemplan ambas caras). [Etapa A: era un if en motor] */
  ignoraMultiplicadorCaras?: boolean;
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

export type TipoParamsPaso =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'multi-enum';

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

/**
 * Una definición de familia YA RESUELTA por el resolver: puede venir del
 * catálogo fijo (codigo = FamiliaCodigo) o de una FamiliaTenant de la base
 * (codigo = UUID de la fila). Mismo contrato que DefinicionFamilia — el
 * motor no distingue el origen. [Etapa C]
 */
/**
 * Superficie sobre la que un paso acomoda piezas. El dispatcher rutea por esto
 * en vez de por `familiaCodigo`, así una familia de tenant y una del sistema
 * que declaren la misma superficie corren por la misma vía.
 *  - `rollo` → acomodo en rollo continuo (shelf-rollo).
 *  - `pliego` / `pliegos_multiples` → hoja/placa finita (grid 2D).
 *  - `segun_material` → se decide en runtime por la máquina y la subfamilia del
 *    material (una impresora de rollo o un vinilo dan rollo; una flatbed o un
 *    rígido dan placa). Lo usa impresión por área, que corre sobre ambos.
 */
export type SuperficieNesting =
  | 'pliego'
  | 'pliegos_multiples'
  | 'rollo'
  | 'segun_material';

export type DefinicionFamiliaResuelta = Omit<DefinicionFamilia, 'codigo'> & {
  codigo: string;
  /** true si viene de una FamiliaTenant (fila de la base). */
  esDeTenant?: boolean;
  tenantId?: string;
  /** Sólo para tenant: inhabilitada no aparece en selectores, pero el
   *  resolver la sigue resolviendo para rutas/OTs históricas (§8.6). */
  activo?: boolean;
};

/**
 * Piezas que un paso hereda de otro: en vez de acomodar las piezas del
 * trabajo, arma una pieza sintética por cada unidad que publicó el paso
 * anterior (un pliego impreso, por ejemplo).
 */
export interface FuentePiezasNesting {
  /** Claves del JobContext que aportan la cantidad, en orden de preferencia.
   *  La primera que traiga un número positivo gana. */
  cantidadDesde: string[];
  /** Clave del JobContext con el ancho de la pieza heredada. */
  anchoDesde: string;
  /** Clave del JobContext con el alto de la pieza heredada. */
  altoDesde: string;
}

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
  /** Registro en el tablero. Si se omite, se deriva de la categoría:
   *  produccion_impresion → 'solo_completar', el resto → 'cronometro'. */
  modoRegistro?: ModoRegistroPaso;
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
  /** Tipos de perfil operativo que la familia acepta (CORTE, IMPRESION,
   *  MIXTO…). Si se omite, acepta cualquiera. [Etapa A: era un if duplicado
   *  en motor.service y config-pasos.service] */
  tiposPerfilCompatibles?: string[];
  /** La familia NO factura consumibles de máquina (tinta/tóner) aunque la
   *  plantilla los declare — ej: plotter_corte sobre una impresora con corte
   *  integrado corta, no imprime. [Etapa A: era un if en motor] */
  sinConsumiblesMaquina?: boolean;

  // --- Nesting: de dónde salen las piezas y los números (Etapa A tardía) ---
  /**
   * Fuentes de piezas heredadas que la familia admite, por código.
   *
   * Algunos pasos no acomodan las piezas que compró el cliente sino lo que
   * salió de un paso anterior: el laminado lamina el PLIEGO impreso, no la
   * tarjeta; el montaje puede pegar la pieza terminada o el pliego. La
   * fuente `piezas_jobcontext` es implícita y no se declara — es usar las
   * piezas del propio trabajo.
   *
   * Si la familia declara más de una, el modelador elige con el param
   * `fuentePiezas` (`fuentePiezasMontaje` en los pasos ya guardados).
   * [Etapa A: laminado tenía estas claves cableadas en el dispatcher]
   */
  fuentesPiezasNesting?: Record<string, FuentePiezasNesting>;
  /** Fuente de piezas cuando el modelador no eligió ninguna. Si se omite,
   *  el paso acomoda las piezas del propio trabajo. */
  fuentePiezasDefault?: string;

  /**
   * Superficie sobre la que el paso acomoda. Presente ⇔ el dispatcher rutea
   * por esta declaración en vez de por `familiaCodigo`. Lo declaran las
   * familias de tenant (elección del wizard, superficie fija) y las del
   * sistema que ya se pasaron a esta vía (impresión por área, `segun_material`).
   */
  nestingConfig?: {
    superficie: SuperficieNesting;
  } | null;

  /**
   * De dónde sale el margen físico que el sustrato NO puede usar.
   *
   * Por defecto es la máquina, campo `margenesNoImprimiblesMm`. Laminado mide
   * su desperdicio en otro campo, y en el pouch el borde sellado lo trae el
   * material, no la máquina: un escalar que vale para los cuatro lados.
   * [Etapa A: eran dos if por familia en nesting-config]
   */
  origenMargenesNesting?: {
    fuente: 'maquina' | 'material';
    campo: string;
    /** El campo trae un escalar y se aplica igual a los 4 lados. */
    forma?: 'uniforme';
  };
  /** Campo de `parametrosTecnicosJson` que aporta la separación entre piezas
   *  cuando nadie la configuró — laminado usa el paso entre pliegos de la
   *  laminadora. [Etapa A: era un if por familia en nesting-config] */
  campoSeparacionMaquina?: string;
  /** Márgenes a usar cuando ni la máquina ni el material los declaran.
   *  [Etapa A: era la tabla `defaultMarginForFamily`] */
  margenesNestingDefault?: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;
    startMm?: number;
    endMm?: number;
  };
  /** Separación entre piezas por defecto, en mm.
   *  [Etapa A: era la tabla `defaultSeparationForFamily`] */
  separacionNestingDefaultMm?: number;
  /**
   * Cómo se interpreta el número de separación que cargó el modelador.
   *
   * `demasia` (default) — es demasía por pieza: cada pieza se agranda y la
   * separación real entre dos vecinas es el doble.
   * `literal` — es aire entre piezas y se usa tal cual, sin demasía. Es el
   * caso del pouch: ahí no hay refile, las piezas se separan y listo.
   * [Etapa A: eran tres if de plastificado_pouch en nesting-config]
   */
  semanticaSeparacion?: 'literal' | 'demasia';
  /** Magnitud que alimenta la productividad cuando el modelador no eligió una.
   *  Montaje cuenta piezas a pegar, no las placas que consumió.
   *  [Etapa A: era un if en motor cuyo cuerpo ya existía genérico] */
  magnitudTiempoDefault?: string;

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

  // --- Pre-pasada de medidas ---
  /**
   * La familia MUTA medidas del JobContext y el motor la resuelve en una
   * PASADA PREVIA al bucle, sin importar dónde esté en la ruta.
   *
   * Así el orden de la ruta puede ser el orden REAL de producción (en una lona
   * se imprime, después se refuerza) sin que el costo salga mal: la impresión
   * lee la medida ya agrandada aunque el refuerzo figure después.
   *
   * A cambio, la familia NO puede depender de nada que publique un paso
   * anterior — en la pre-pasada todavía no corrió ninguno. El motor no le
   * permite `HEREDAR_DEL_OUTPUT_CANONICO` y su regla CONDICIONAL no puede
   * referenciar outputs canónicos (lo valida `validacion-pre-pasada.ts`).
   *
   * Ver docs/modificaciones-fisicas-lona-diseno.md
   */
  mutaMedidasEnPrePasada?: boolean;

  // --- Productos / aplicación ---
  /** Productos típicos donde aplica la familia (informativo, para UI). */
  productosTipicos?: string[];
}
