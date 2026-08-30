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
  // Producción / impresión
  | 'impresion_por_hoja'
  | 'impresion_por_area'
  | 'impresion_por_pieza'
  | 'impresion_3d'
  | 'aplicacion_transfer'
  | 'aplicacion_transfer_textil'
  | 'grabado_laser'
  // Corte y formado
  | 'corte_guillotina'
  | 'plotter_corte'
  | 'corte_laser'
  | 'troquelado_digital'
  | 'cnc'
  | 'plegado'
  | 'corte_manual' // [Fase E]
  | 'corte_hilo_caliente'
  // Terminaciones
  | 'laminado'
  | 'plastificado_pouch'
  | 'pintura_superficial'
  | 'lijado_canteado'
  // Encuadernación / armado
  | 'abrochado_caballete'
  | 'encuadernado_anillado'
  | 'engomado_emblocado'
  // Estructural / montaje
  | 'montaje_sobre_sustrato'
  | 'ensamble_estructural'
  | 'estructura_bastidor'
  | 'iluminacion_led'
  // Operaciones manuales
  | 'embalaje'
  | 'trabajo_manual'
  // Modificaciones físicas (sub-categoría dentro de manuales)
  // [F4 efectos] `modificacion_pre` se podó: agrandar la medida dejó de ser
  // una familia y pasó a ser un EFECTO que declara cualquier paso real.
  | 'modificacion_post'
  | 'colocacion_ojales'
  | 'colocacion_raspadita'
  // Logística / instalación
  | 'instalacion_in_situ'
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
  'OBLIGATORIO' | 'OPCIONAL' | 'CONDICIONAL' | 'NO_EJECUTAR';

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
  | 'VINILO_CORTE'
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
  | 'PEGATINA_RASPADITA'
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
  /** Permite cualquier materia prima activa del tenant. Debe declararse de
   * forma explícita para distinguir un slot universal de una compatibilidad
   * técnica incompleta. */
  sinRestricciones?: boolean;
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

  // --- Slot alimentado por el derivador geométrico de la familia ---
  // (docs/derivadores-geometricos-diseno.md §4.1-4.2)
  /**
   * La cantidad del slot es esta magnitud del derivador del paso (cable =
   * `cableMl`, anclajes = `anclajes`), no la fórmula configurada. Si además
   * el paso publica un despiece bajo el CÓDIGO de este slot y la variante
   * declara `largoBarra` (m), se cobran unidades ENTERAS con packing 1D
   * (barras de perfil — el sobrante se paga, como en la ferretería).
   * [Etapa 2 derivadores: era `cantidadSlotPrimitivaCarteleria` en motor]
   */
  magnitudDerivada?: string;
  /** Cantidad fija del slot (la fuente LED: 1 por cartel), gane quien gane
   *  la selección. [Etapa 2 derivadores: era un if por slot en motor] */
  cantidadFija?: number;
  /**
   * Selección por capacidad de fábrica: si el slot de DB no configura los
   * tres campos del criterio, el motor usa MENOR_CAPACIDAD_QUE_CUMPLA con
   * estos defaults. `inputMagnitud` lee la magnitud del derivador del MISMO
   * paso (watts requeridos — todavía no publicados como output durante la
   * resolución de slots); `inputCampo` lee un flat key del JobContext.
   * El modelador puede pisar cualquiera desde el slot de DB.
   * [Etapa 2 derivadores: era el if `esFuenteLed` en motor]
   */
  criterioCapacidadDefault?: {
    inputMagnitud?: string;
    inputCampo?: string;
    /** Atributo de la variante que declara la capacidad (ej: `capacidad`). */
    materialCampo: string;
  };
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
  'string' | 'number' | 'boolean' | 'enum' | 'multi-enum';

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
  /** Oculta el campo salvo que otro parámetro tenga el valor indicado. */
  visibleCuando?: { campo: string; valor: unknown };
  /**
   * El campo es editable por el COMERCIAL al cotizar POR DISEÑO de la
   * familia, sin que el modelador lo declare en
   * `paramsPasoJson.camposEditablesComercial` (la densidad LED, la
   * separación de refuerzos del bastidor). El sheet lo ofrece siempre y
   * `paramsEfectivos` del motor lo acepta del `configPasoRuntime`.
   * [Etapa 3 derivadores: era CAMPOS_SIEMPRE_EDITABLES_POR_FAMILIA en motor
   * + una lista espejo hardcodeada en el sheet]
   */
  expuestoAlComercial?: boolean;
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
  'pliego' | 'pliegos_multiples' | 'rollo' | 'segun_material';

/**
 * Estrategia de acomodado que corre el dispatcher. Si la familia no declara
 * una, la elige la superficie: rollo → shelf-rollo; pliego(s) → grid 2D.
 * Las nombradas cubren los comportamientos que antes ruteaban por
 * `familiaCodigo` (casos 2-6 del dispatcher):
 *  - `corte_rollo`: shelf-rollo sin panelizado; en modo HOJAS no acomoda.
 *  - `laminado_rollo`: rollo que envuelve pliegos ya impresos.
 *  - `pouch`: plastificado en formato finito (pouch).
 *  - `montaje`: piezas propias o de outputs previos sobre otro sustrato.
 *  - `pliego_digital`: grid 2D single sobre pliego; si el paso tiene
 *    imposición de caballete configurada, corre el caballete.
 *  - `irregular_placa`: contornos vectoriales sobre placa finita.
 */
export type EstrategiaNesting =
  | 'corte_rollo'
  | 'laminado_rollo'
  | 'pouch'
  | 'montaje'
  | 'pliego_digital'
  | 'irregular_placa';

/**
 * Guard del motor cuando el acomodado declarado NO produjo layout: qué
 * condición corta la cotización (en vez del fallback silencioso a cantidad
 * cruda) y con qué diagnóstico. Cada valor nombra un guard del motor
 * [Etapa F2: antes era una tabla por `familiaCodigo` en motor.service]:
 *  - `laminado_rollo`: corta si el film va por metro lineal.
 *  - `pouch`: corta si la cantidad es CALCULADO_POR_PASO.
 *  - `pliego_digital`: corta con pliego automático sin candidato, caballete
 *    inválido, o pliego fijo resoluble donde la pieza no entra.
 *  - `sustrato`: corta sólo si el sustrato es resoluble (pieza no entra).
 *  - `montaje`: corta siempre (sin plan de montaje no se cotiza).
 * Sin declarar → sin guard: fallback silencioso (vía de tenant, intacta).
 */
export type GuardSinLayoutNesting =
  'laminado_rollo' | 'pouch' | 'pliego_digital' | 'sustrato' | 'montaje';

export type DefinicionFamiliaResuelta = Omit<DefinicionFamilia, 'codigo'> & {
  codigo: string;
  /** true si es un PasoTenant (instancia de plantilla, fila de la base). */
  esDeTenant?: boolean;
  /** Sólo para instancias: de qué plantilla del sistema HEREDA la ficha.
   *  docs/pasos-tenant-por-plantilla-diseno.md */
  plantillaCodigo?: string;
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
  /** Herramientas que el cotizador debe montar por requerimiento del proceso,
   *  no por una bandera particular del producto. */
  herramientasCotizacion?: Array<'diseno_vectorial'>;
  /** Herramientas que esta familia PUEDE habilitar desde la configuración del
   * paso. A diferencia de `herramientasCotizacion`, no se fuerzan en todos los
   * productos que usen la familia. */
  herramientasCotizacionDisponibles?: Array<'diseno_vectorial'>;
  /** Una pieza que supera la placa puede dividirse y recibir uniones físicas.
   * Es propio del hilo caliente; láser y CNC deben rechazarla y enviarla a CAM. */
  permiteSegmentacionVectorial?: boolean;

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
   * Acomodado del paso. Presente ⇔ el paso hace nesting; el dispatcher rutea
   * SOLO por esta declaración (ya no hay ruteo por `familiaCodigo`). Lo
   * declaran las familias de tenant (elección del wizard, superficie fija) y
   * todas las del sistema que acomodan piezas.
   */
  nestingConfig?: {
    superficie: SuperficieNesting;
    /** Si se omite, la superficie elige (rollo → shelf, pliego → grid 2D). */
    estrategia?: EstrategiaNesting;
    /** Si se omite, sin layout el motor sigue con su fallback silencioso. */
    guardSinLayout?: GuardSinLayoutNesting;
    /** Cuando el dispatcher no dio layout (y el guard no cortó), ¿con qué se
     *  cotiza la cantidad CALCULADO_POR_PASO? `m2_crudos` = m² de las piezas
     *  sin desperdicio (el fallback histórico de impresión por área y
     *  plotter). Sin declarar → cantidad del pedido tal cual.
     *  [Tanda A: era un if con los dos nombres en motor.service] */
    fallbackSinLayout?: 'm2_crudos';
  } | null;

  /** Paso de IMPRESIÓN con modos de color (CMYK, sin impresión, etc.):
   *  habilita el eje modo color en el motor y la pregunta en el editor.
   *  [Etapa F3: era FAMILIAS_IMPRESION en motor.service + listas de códigos
   *  en el editor] */
  esImpresion?: boolean;

  /** Mecanismo de cantidad con el que ARRANCA el paso en el editor cuando el
   *  modelador no eligió (la lista `mecanismosCantidadSoportados` dice qué se
   *  puede; esto dice cuál es el natural: corte manual arranca heredando).
   *  Si se omite, el primero de la lista. [Tanda C: era un if por familia en
   *  el editor] */
  mecanismoCantidadDefault?: MecanismoCantidad;

  /** Cómo arranca el RITMO del paso en el editor cuando nadie lo configuró:
   *  en qué unidad se mide, si es productividad o tiempo por tanda, y qué
   *  cantidad cuenta (montaje cuenta piezas a montar; instalación mide m²).
   *  [Tanda C: eran tres funciones con nombres cableados en el editor] */
  ritmoDefault?: {
    unidad?: 'unidades_h' | 'm2_h' | 'ml_h' | 'mm_min';
    modoCalculo?: 'productivity' | 'batch_time';
    fuenteCantidad?: string;
  };

  /** Output canónico que este paso hereda POR DEFAULT cuando su mecanismo es
   *  HEREDAR_DEL_OUTPUT_CANONICO y el modelador no fijó `campoOutput`.
   *  Convención: el output natural del paso anterior (corte hereda
   *  `pliegos_impresos`, impresión hereda `pliegos_calculados`).
   *  [Etapa F3: era un switch por familia en motor.service] */
  outputHeredadoDefault?: string;

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

  /** Los params del schema se editan con el editor GENÉRICO de params (el
   *  motor los consume vía paramsEfectivosDelPaso y la familia no tiene UI a
   *  medida que los pise). [Tanda B: era FAMILIAS_CON_PARAMS_EDITABLES, una
   *  lista curada en el frontend] */
  editorParamsGenerico?: boolean;

  // --- Efectos (docs/efectos-de-paso-diseno.md) ---
  /**
   * Efectos que un paso de esta familia PUEDE declarar: cosas que el paso le
   * exige al trabajo, más allá de consumir tiempo y materiales.
   *
   *  - `demasiaMedida`: agranda la medida del trabajo (el tensado de una lona
   *    necesita 100 mm por lado para envolver el bastidor).
   *
   * Gobierna qué ofrece el EDITOR; el motor aplica lo que el paso tenga
   * configurado. Antes esto era `mutaMedidasEnPrePasada`, un flag exclusivo
   * de la familia `modificacion_pre`.
   */
  efectosSoportados?: Array<'demasiaMedida'>;

  // --- Derivador geométrico (docs/derivadores-geometricos-diseno.md §3) ---
  /**
   * La geometría del paso se DERIVA de las medidas (metros de perfil de un
   * bastidor, módulos LED sembrados, ojales por perímetro): nadie la carga a
   * mano. Presente ⇔ el motor corre el derivador del catálogo
   * (`motor-universal/derivadores/`) UNA vez por paso y de su resultado salen
   * la cantidad, los outputs canónicos, los slots derivados y el guard.
   * [Refactor derivadores: eran ifs por familia en 4 lugares del motor]
   */
  derivador?: {
    /** Código en el catálogo de derivadores (`derivadores/index.ts`). */
    codigo: string;
    /** Magnitud del resultado que es la cantidad del paso (CALCULADO_POR_PASO). */
    magnitudPrincipal: string;
    /**
     * NOMBRE humano de esa magnitud ("ml de perfil", "módulos", "ojales").
     * El editor lo usa para que el ritmo diga "6 ml de perfil/h" en vez de
     * "6 unid./h" (H1 del relevamiento del editor de ruta).
     */
    unidadPrincipal?: string;
    /**
     * Magnitudes derivadas que el tenant puede elegir como DRIVER del
     * tiempo del paso, además de la principal ("el corte se mide por
     * cortes, no por ml" — feedback del usuario). El editor las ofrece en
     * "¿El ritmo cuenta…?" y el motor las resuelve con
     * `productivityQuantitySource: "derivada:<magnitud>"`.
     */
    magnitudesTiempo?: Array<{ magnitud: string; etiqueta: string }>;
    /**
     * Outputs canónicos ← magnitudes del derivador. Un paso puede publicar
     * varios drivers (el bastidor publica 5) aunque su cantidad sea uno solo.
     * Ej: { puntos_soldadura: 'puntosSoldadura' }.
     */
    outputs?: Record<string, string>;
    /**
     * Geometría que el derivador PUBLICA al JobContext para que los pasos
     * siguientes la lean (mismo patrón que `piezasVisibles`). Mapea
     * claveJobContext ← clave de la `traza` del derivador. Ej. el bastidor
     * publica `{ interiorMm: 'interior', lonaBrutaMm: 'lonaBruta' }` y el
     * derivador de LED lee `jobContext.interiorMm` en vez de la medida exterior.
     * Ola #2, docs/estructura-bastidor-outputs-diseno.md §4/§7.5.
     */
    publicaCanon?: Record<string, string>;
    /**
     * Slot cuyo material alimenta al derivador (los atributos de la variante:
     * coberturaM2/pasoMm del módulo LED). El motor lo resuelve ANTES de correr
     * el derivador — declarado acá, no un if por familia.
     */
    materialSlot?: string;
    /**
     * Diagnóstico cuando el derivador devuelve null (sin esto la cantidad
     * saldría 0 y el paso cobraría $0 en silencio). El motor antepone
     * `El paso "<nombre>" `.
     */
    mensajeSinDatos: string;
    sugerenciaSinDatos?: string;
    /** Código del error. Default: `derivador_sin_datos`. */
    codigoSinDatos?: string;
  };

  // --- Primitivas de familia (docs/primitivas-de-familia-diseno.md) ---
  /**
   * Algoritmos propios del oficio de la familia, mudados del motor al
   * catálogo `motor-universal/primitivas/`. Cada campo apunta a un registro
   * tipado por gancho; sin declarar → vía genérica del motor.
   * P1: `tiempoRun` y `cantidadPropia`. P2-P4 agregan factorVelocidad,
   * desgaste, compraSustrato, seleccionPerfil y avisos.
   */
  primitivas?: {
    /** T-3 con algoritmo propio: el run NO sale de productividad×cantidad
     *  (la guillotina lo deriva del plan de cortes). */
    tiempoRun?: string;
    /** CALCULADO_POR_PASO sin nesting ni derivador: cantidad propia
     *  (los ml de costura de una modificación física). */
    cantidadPropia?: string;
    /** Multiplicador (≥1) de la velocidad del perfil según el trabajo:
     *  una PPM en páginas A4 rinde menos con pliegos grandes. [P2] */
    factorVelocidad?: string;
    /** Unidades de desgaste (clicks) que el paso consume de los componentes
     *  de la máquina; sin declarar, el paso no clickea. [P2] */
    desgaste?: string;
    /** Consumo del slot → unidades de COMPRA del material (pliegos de
     *  impresión → hojas comerciales). [P2] */
    compraSustrato?: string;
    /** Selección de perfil propia del oficio, sobre los candidatos ya
     *  filtrados por modo de color (ese filtro es genérico del motor).
     *  null de la primitiva = sin decisión, sigue el pipeline. [P3] */
    seleccionPerfil?: string;
    /** Diagnósticos propios (WARNINGS que no cortan la cotización). [P4] */
    avisos?: string[];
  };

  // --- Productos / aplicación ---
  /** Productos típicos donde aplica la familia (informativo, para UI). */
  productosTipicos?: string[];
}
