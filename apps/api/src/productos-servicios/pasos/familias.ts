/**
 * Catálogo CERRADO de FAMILIAS de paso.
 *
 * Modificar este archivo (agregar/quitar familias) requiere deploy de código.
 * Decisión: hardcoded en TS por estabilidad del modelo conceptual y tipado fuerte.
 *
 * Ver `docs/motor-por-pasos-analisis/01-tipos-de-paso.md` para la justificación.
 *
 * Niveles de detalle:
 *   - Las familias usadas en los 4 productos validados de Fase E están en
 *     detalle completo (todos los campos).
 *   - Las familias menos usadas tienen declaración mínima (suficiente para
 *     que el catálogo cierre); sus campos avanzados se completan cuando aparezca
 *     el primer producto que las use.
 */

import type {
  CompatibilidadMaterialSlot,
  DefinicionFamilia,
  DefinicionFamiliaResuelta,
  FamiliaCodigo,
  FuentePiezasNesting,
  ModoRegistroPaso,
} from './types';

const MP = {
  sustratoHoja: {
    familiasMateriaPrima: ['SUSTRATO'],
    subfamiliasMateriaPrima: ['SUSTRATO_HOJA'],
  },
  sustratoImpresionArea: {
    familiasMateriaPrima: ['SUSTRATO', 'TRANSFERENCIA_LAMINACION'],
    subfamiliasMateriaPrima: [
      'SUSTRATO_ROLLO_FLEXIBLE',
      'SUSTRATO_RIGIDO',
      'OBJETO_PROMOCIONAL_BASE',
      'FILM_TRANSFERENCIA',
      'PAPEL_TRANSFERENCIA',
    ],
  },
  // Materiales continuos que una cuchilla móvil puede procesar. Se limita por
  // template (y no por la subfamilia magnética completa) para no ofrecer
  // imanes rígidos/redondos en un plotter.
  materialFlexibleCortable: {
    templateIds: [
      'vinilo_de_corte_rollo_v1',
      'sustrato_rollo_flexible_v1',
      'vinilo_esmerilado_rollo_v1',
      'iman_flexible_rollo_v1',
    ],
  },
  sustratoPieza: {
    familiasMateriaPrima: ['SUSTRATO'],
    subfamiliasMateriaPrima: [
      'SUSTRATO_RIGIDO',
      'OBJETO_PROMOCIONAL_BASE',
      'TEXTIL_INDUMENTARIA',
    ],
  },
  sustratoCorteVectorial: {
    familiasMateriaPrima: ['SUSTRATO'],
    subfamiliasMateriaPrima: ['SUSTRATO_RIGIDO'],
  },
  aditiva3d: {
    familiasMateriaPrima: ['ADITIVA_3D'],
    subfamiliasMateriaPrima: ['FILAMENTO_3D', 'RESINA_3D'],
  },
  sustratoGrabable: {
    familiasMateriaPrima: [
      'SUSTRATO',
      'METAL_ESTRUCTURA',
      'POP_EXHIBIDOR',
      'HERRAJE_ACCESORIO',
      'SELLOS',
    ],
    subfamiliasMateriaPrima: [
      'SUSTRATO_RIGIDO',
      'OBJETO_PROMOCIONAL_BASE',
      'CHAPA_METALICA',
      'SEMIELABORADO_POP',
      'ARGOLLA_LLAVERO_ACCESORIO',
      'GOMA_LASERABLE',
    ],
  },
  filmTransfer: {
    familiasMateriaPrima: ['TRANSFERENCIA_LAMINACION'],
    subfamiliasMateriaPrima: ['FILM_TRANSFERENCIA', 'PAPEL_TRANSFERENCIA'],
  },
  textil: {
    familiasMateriaPrima: ['SUSTRATO'],
    subfamiliasMateriaPrima: ['OBJETO_PROMOCIONAL_BASE', 'TEXTIL_INDUMENTARIA'],
  },
  laminadoFilm: {
    familiasMateriaPrima: ['TRANSFERENCIA_LAMINACION'],
    subfamiliasMateriaPrima: ['LAMINADO_FILM'],
  },
  laminadoPouch: {
    familiasMateriaPrima: ['TRANSFERENCIA_LAMINACION'],
    subfamiliasMateriaPrima: ['LAMINADO_POUCH'],
  },
  quimicoAcabado: {
    familiasMateriaPrima: ['QUIMICO_AUXILIAR', 'PINTURA_RECUBRIMIENTO'],
    subfamiliasMateriaPrima: ['QUIMICO_ACABADO', 'PRIMER_SELLADOR'],
  },
  filmMetalico: {
    familiasMateriaPrima: ['TRANSFERENCIA_LAMINACION'],
    subfamiliasMateriaPrima: ['LAMINADO_FILM', 'FILM_TRANSFERENCIA'],
  },
  matriz: {
    familiasMateriaPrima: ['HERRAJE_ACCESORIO', 'METAL_ESTRUCTURA'],
    subfamiliasMateriaPrima: [
      'FIJACION_AUXILIAR',
      'OJAL_OJALILLO_REMACHE',
      'CHAPA_METALICA',
    ],
  },
  pintura: {
    familiasMateriaPrima: ['PINTURA_RECUBRIMIENTO'],
    subfamiliasMateriaPrima: ['PINTURA_CARTELERIA', 'PRIMER_SELLADOR'],
  },
  grapas: {
    familiasMateriaPrima: ['HERRAJE_ACCESORIO', 'TERMINACION_EDITORIAL'],
    subfamiliasMateriaPrima: ['FIJACION_AUXILIAR', 'ANILLADO_ENCUADERNACION'],
  },
  anillo: {
    familiasMateriaPrima: ['TERMINACION_EDITORIAL'],
    subfamiliasMateriaPrima: ['ANILLADO_ENCUADERNACION'],
  },
  adhesivo: {
    familiasMateriaPrima: ['ADHESIVO_TECNICO', 'QUIMICO_AUXILIAR'],
    subfamiliasMateriaPrima: [
      'ADHESIVO_LIQUIDO_ESTRUCTURAL',
      'CINTA_DOBLE_FAZ_TECNICA',
      'AUXILIAR_PROCESO',
    ],
  },
  tapa: {
    familiasMateriaPrima: ['TERMINACION_EDITORIAL', 'SUSTRATO'],
    subfamiliasMateriaPrima: ['TAPA_ENCUADERNACION', 'SUSTRATO_HOJA'],
  },
  cartonBase: {
    familiasMateriaPrima: ['SUSTRATO', 'POP_EXHIBIDOR'],
    subfamiliasMateriaPrima: ['SUSTRATO_HOJA', 'SEMIELABORADO_POP'],
  },
  cinta: {
    familiasMateriaPrima: ['ADHESIVO_TECNICO', 'PACKING_INSTALACION'],
    subfamiliasMateriaPrima: [
      'CINTA_DOBLE_FAZ_TECNICA',
      'CONSUMIBLE_INSTALACION',
      'SISTEMA_COLGADO_MONTAJE',
    ],
  },
  packaging: {
    familiasMateriaPrima: ['TERMINACION_EDITORIAL', 'PACKING_INSTALACION'],
    subfamiliasMateriaPrima: ['EMBALAJE_PROTECCION', 'CONSUMIBLE_INSTALACION'],
  },
  plantillaCaja: {
    familiasMateriaPrima: ['POP_EXHIBIDOR', 'SUSTRATO'],
    subfamiliasMateriaPrima: [
      'ACCESORIO_EXHIBIDOR_CARTON',
      'SEMIELABORADO_POP',
      'SUSTRATO_RIGIDO',
      'SUSTRATO_HOJA',
    ],
  },
  sustratoMontaje: {
    // METAL_ESTRUCTURA/CHAPA_METALICA: la chapa trasera de un cartel se
    // monta igual que un rígido — se corta de la hoja (1220×2440) con el
    // nesting según material. Sin esto, "Chapa para cenefa" en el slot de
    // montaje protestaba compatibilidad.
    familiasMateriaPrima: [
      'SUSTRATO',
      'MAGNETICO_FIJACION',
      'POP_EXHIBIDOR',
      'METAL_ESTRUCTURA',
    ],
    subfamiliasMateriaPrima: [
      'SUSTRATO_RIGIDO',
      'SUSTRATO_ROLLO_FLEXIBLE',
      'SUSTRATO_HOJA',
      'IMAN_CERAMICO_FLEXIBLE',
      'SEMIELABORADO_POP',
      'ACCESORIO_MONTAJE_POP',
      'CHAPA_METALICA',
    ],
  },
  soldadura: {
    familiasMateriaPrima: ['METAL_ESTRUCTURA', 'HERRAJE_ACCESORIO'],
    subfamiliasMateriaPrima: [
      'CHAPA_METALICA',
      'PERFIL_ESTRUCTURAL',
      'FIJACION_AUXILIAR',
    ],
  },
  electricidad: {
    familiasMateriaPrima: ['ELECTRONICA_CARTELERIA', 'NEON_LUMINARIA'],
    subfamiliasMateriaPrima: [
      'MODULO_LED_CARTELERIA',
      'FUENTE_ALIMENTACION_LED',
      'CABLEADO_CONECTICA',
      'CONTROLADOR_LED',
      'NEON_FLEX_LED',
      'ACCESORIO_NEON_LED',
    ],
  },
  etiqueta: {
    familiasMateriaPrima: ['TERMINACION_EDITORIAL', 'PACKING_INSTALACION'],
    subfamiliasMateriaPrima: ['ETIQUETADO_IDENTIFICACION'],
  },
  banding: {
    familiasMateriaPrima: ['PACKING_INSTALACION', 'ADHESIVO_TECNICO'],
    subfamiliasMateriaPrima: [
      'CONSUMIBLE_INSTALACION',
      'SISTEMA_COLGADO_MONTAJE',
      'VELCRO_CIERRE_TECNICO',
    ],
  },
  insumoManual: {
    familiasMateriaPrima: [
      'ADHESIVO_TECNICO',
      'PACKING_INSTALACION',
      'HERRAJE_ACCESORIO',
      'TERMINACION_EDITORIAL',
      'QUIMICO_AUXILIAR',
    ],
    subfamiliasMateriaPrima: [
      'CINTA_DOBLE_FAZ_TECNICA',
      'CONSUMIBLE_INSTALACION',
      'SISTEMA_COLGADO_MONTAJE',
      'VELCRO_CIERRE_TECNICO',
      'OJAL_OJALILLO_REMACHE',
      'FIJACION_AUXILIAR',
      'ETIQUETADO_IDENTIFICACION',
      'COMPONENTE_EDITORIAL',
      'PEGATINA_RASPADITA',
      'AUXILIAR_PROCESO',
    ],
  },
} satisfies Record<string, CompatibilidadMaterialSlot>;

// ============================================================================
// 3.1 Pre-prensa (1)
// ============================================================================

const pre_prensa: DefinicionFamilia = {
  codigo: 'pre_prensa',
  nombre: 'Pre-prensa / revisión y armado',
  descripcion:
    'Revisión de archivos, armado y preparación del material para imprimir. La imposición la calcula el paso que imprime.',
  categoria: 'pre_prensa',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-1'],
  // Sólo DIRECTO (2026-08-11): CALCULADO era del look-ahead retirado (la
  // imposición vive en el paso que imprime). Cero configs lo usaban.
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL', 'CONDICIONAL'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  // Ya no publica nada: acomodar es capacidad del paso que imprime, que es
  // el que conoce la máquina, el pliego y el material. Mientras la imposición
  // vivió acá, ningún producto podía imprimirse sin pre-prensa.
  outputsCanonicos: [],
  validaciones: [
    {
      codigo: 'requires_cantidad',
      tipo: 'REQUIRES_INPUT',
      campo: 'cantidad',
      mensaje: 'Falta declarar cantidad',
    },
  ],
  // El agrupado de talonario NO es de pre-prensa: lo consume el paso que
  // hace la imposición (impresión por hoja) — pre-prensa hoy es revisión y
  // armado por tiempo, nada más. [Corrección 2026-08-07: un duplicado
  // efímero acá apuntaba la pregunta del editor a un param que el motor
  // ignora en este paso.]
  paramsPasoSchema: [],
  productosTipicos: [
    'Tarjetas de Visita',
    'Vinilo adhesivo',
    'Talonarios',
    'Rígidos impresos',
  ],
};

// ============================================================================
// 3.2 Producción / impresión (6)
// ============================================================================

const impresion_por_hoja: DefinicionFamilia = {
  codigo: 'impresion_por_hoja',
  // [P2] Antes: tres ramas impresion_por_hoja en el motor (factor A4 del
  // PPM, clicks de desgaste, pliegos→hojas de compra).
  primitivas: {
    factorVelocidad: 'a4_equivalente',
    desgaste: 'clicks_a4',
    compraSustrato: 'pliegos_a_hojas',
    seleccionPerfil: 'cadena_caras_gramaje',
    avisos: ['perfil_doble_faz'],
  },
  // [Tanda C] Antes: defaults cableados por nombre en el editor.
  // La imposición vive en este paso, por lo que su cantidad efectiva sale de
  // su propio nesting. Heredar era un remanente de cuando pre-prensa acomodaba.
  mecanismoCantidadDefault: 'CALCULADO_POR_PASO',
  // [Etapa F3] Antes: FAMILIAS_IMPRESION en motor.service.
  esImpresion: true,
  // [Etapa F3] Antes: switch defaultOutputParaHeredar en motor.service.
  nombre: 'Impresión por hoja',
  categoria: 'produccion_impresion',
  // [Etapa F] Antes: caso 6 del dispatcher, ruteado por familiaCodigo.
  nestingConfig: {
    superficie: 'pliego',
    estrategia: 'pliego_digital',
    guardSinLayout: 'pliego_digital',
  },
  descripcion:
    'Imprime sobre papel/cartulina cortado a tamaño pliego. Típico de Tarjetas, Talonarios, Volantes.',
  relacionMaquinaSoportada: ['M-1', 'M-2'],
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: [
    'HEREDAR_DEL_OUTPUT_CANONICO',
    'CALCULADO_POR_PASO',
  ],
  modosActivacionSoportados: ['OBLIGATORIO', 'CONDICIONAL'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: ['caras', 'tipoCopia'],
  slotsRequeridos: [
    {
      codigo: 'sustrato_principal',
      nombre: 'Sustrato principal',
      tipo: 'SUSTRATO',
      requerido: true,
      compatibilidadMaterial: MP.sustratoHoja,
      // Los pliegos del nesting ya contemplan doble faz: el papel no se
      // duplica por caras. [Etapa A]
      ignoraMultiplicadorCaras: true,
    },
    {
      codigo: 'tinta_o_toner',
      nombre: 'Tinta / tóner',
      tipo: 'CONSUMIBLE_MAQUINA',
      requerido: true,
    },
  ],
  permiteSlotsAdicionales: false,
  // v3.0: solo IMPRESORA_LASER (INYECCION_TINTA descartada según doc §4).
  plantillasCompatibles: ['IMPRESORA_LASER'],
  // Pinza y borde no imprimible: 5 mm alrededor si la máquina no los declara.
  // [Etapa A: era `defaultMarginForFamily`]
  margenesNestingDefault: { leftMm: 5, rightMm: 5, topMm: 5, bottomMm: 5 },
  inputsRequeridos: ['cantidad', 'caras'],
  // Acomodar es capacidad de este paso: es el que conoce la máquina, el
  // pliego y el material. Todo lo que antes publicaba pre-prensa sale de acá.
  outputsCanonicos: [
    'imposicion_calculada',
    'pliegos_calculados',
    'pliegos_impresos',
    'poses_por_pliego',
    'cortes_calculados',
    // Traza interna: permite que duplicado/triplicado repitan la misma
    // imposición de talonario sin volver a publicar sus pilas.
    'talonario_modo_incompleto',
    'talonario_pilas',
    'pliego_impresion_ancho_mm',
    'pliego_impresion_alto_mm',
    'pliego_impresion_area_m2',
    'pliego_impresion_mp_variante_id',
    'tiempo_real_impresion',
    // Imposición de cuadernillo a caballete (cuando el paso la activa):
    // el abrochado valida EXISTS_OUTPUT sobre hojas_por_libro.
    'hojas_por_libro',
    'paginas_blancas',
    'libros_por_juego',
    'plan_imposicion',
  ],
  validaciones: [
    {
      codigo: 'requires_cantidad',
      tipo: 'REQUIRES_INPUT',
      campo: 'cantidad',
      mensaje: 'Falta declarar cantidad',
    },
    {
      codigo: 'requires_caras',
      tipo: 'REQUIRES_INPUT',
      campo: 'caras',
      mensaje: 'Falta declarar simple/doble faz',
    },
  ],
  paramsPasoSchema: [
    {
      // Va en el paso que define el armado del talonario — el del original.
      // Sólo ese hace el agrupamiento y publica las pilas; el duplicado y el
      // triplicado calculan sus pliegos pero no tocan ese número, que es el
      // que usa el abrochado para contar broches.
      campo: 'modoTalonarioIncompleto',
      etiqueta: 'Agrupado por talonario en el pliego',
      tipo: 'enum',
      // `off` es el default REAL del motor (sin agrupado); el schema viejo
      // no lo listaba y declaraba un default que el motor nunca aplicó.
      valoresPermitidos: ['off', 'aprovechar_pliego', 'pose_completa'],
      default: 'off',
      requerido: false,
      descripcion:
        'Cómo se apilan los talonarios sueltos: estándar (off), compartiendo pliego (mínimo papel) o con poses vacías (listo para abrochar).',
    },
  ],
  productosTipicos: [
    'Tarjetas de Visita',
    'Volantes',
    'Talonarios',
    'Folletería',
  ],
};

const impresion_por_area: DefinicionFamilia = {
  codigo: 'impresion_por_area',
  // [Etapa F3] Antes: FAMILIAS_IMPRESION en motor.service.
  esImpresion: true,
  nombre: 'Impresión por área',
  categoria: 'produccion_impresion',
  descripcion:
    'Imprime sobre material en rollo o pliego grande, calculando por m². Típico de gran formato (vinilo, lona, mesh).',
  relacionMaquinaSoportada: ['M-1', 'M-2'],
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: ['CALCULADO_POR_PASO'],
  modosActivacionSoportados: ['OBLIGATORIO'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: ['caras'],
  // Imprime: en una impresora con corte integrado usa el perfil de
  // impresión, nunca el de corte. [Etapa A]
  tiposPerfilCompatibles: ['IMPRESION', 'MIXTO'],
  slotsRequeridos: [
    {
      codigo: 'sustrato_principal',
      nombre: 'Sustrato principal',
      tipo: 'SUSTRATO',
      requerido: true,
      compatibilidadMaterial: MP.sustratoImpresionArea,
    },
    {
      codigo: 'tinta',
      nombre: 'Tinta',
      tipo: 'CONSUMIBLE_MAQUINA',
      requerido: true,
    },
  ],
  permiteSlotsAdicionales: false,
  // v3.0 (doc §6): unificadas en IMPRESORA_GRAN_FORMATO_POR_AREA con
  // discriminantes paramsTecnicosJson.tecnologia (LATEX|SOLVENTE|UV|
  // SUBLIMACION|DTF_*) + .geometria (ROLLO|MESA_EXTENSORA).
  // PLOTTER_CAD también aplica para impresión técnica/CAD por área.
  plantillasCompatibles: ['IMPRESORA_GRAN_FORMATO_POR_AREA', 'PLOTTER_CAD'],
  // Gran formato: 5 mm de aire entre piezas si nadie configuró otra cosa.
  // [Etapa A: era `defaultSeparationForFamily`]
  separacionNestingDefaultMm: 5,
  // Acomoda sobre rollo (lona/vinilo) o placa (rígido) según el material y la
  // máquina — el dispatcher lo resuelve por `segun_material`. Ruteaba por un
  // `familiaCodigo === 'impresion_por_area'` con cascada propia. [Palanca 1b]
  nestingConfig: {
    superficie: 'segun_material',
    guardSinLayout: 'sustrato',
    fallbackSinLayout: 'm2_crudos',
  },
  inputsRequeridos: ['piezas'], // gap H7: lista de piezas
  outputsCanonicos: [
    'm2_calculados',
    'aprovechamiento_pct',
    'tiempo_real_impresion',
  ],
  validaciones: [
    {
      codigo: 'requires_piezas',
      tipo: 'REQUIRES_INPUT',
      campo: 'piezas',
      mensaje: 'Falta declarar las piezas a producir',
    },
  ],
  paramsPasoSchema: [],
  productosTipicos: ['Vinilo adhesivo', 'Lona impresa', 'Mesh', 'Roll-up'],
};

const impresion_por_pieza: DefinicionFamilia = {
  codigo: 'impresion_por_pieza',
  nombre: 'Impresión por pieza',
  categoria: 'produccion_impresion',
  descripcion:
    'Imprime directo sobre piezas individuales (rígidos, tazas, remeras).',
  relacionMaquinaSoportada: ['M-1', 'M-2'],
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'HEREDAR_DEL_OUTPUT_CANONICO',
  ],
  modosActivacionSoportados: ['OBLIGATORIO'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: ['caras'],
  slotsRequeridos: [
    {
      codigo: 'sustrato_principal',
      nombre: 'Sustrato principal',
      tipo: 'SUSTRATO',
      requerido: true,
      compatibilidadMaterial: MP.sustratoPieza,
    },
    {
      codigo: 'tinta',
      nombre: 'Tinta',
      tipo: 'CONSUMIBLE_MAQUINA',
      requerido: true,
    },
  ],
  permiteSlotsAdicionales: false,
  // v3.0: unificada en IMPRESORA_GRAN_FORMATO_POR_AREA con
  // paramsTecnicosJson.geometria=MESA_EXTENSORA + tecnologia=UV.
  // (UV_CILINDRICA descartada según doc §4 — fuera del rubro objetivo).
  plantillasCompatibles: ['IMPRESORA_GRAN_FORMATO_POR_AREA'],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_impresas'],
  validaciones: [
    {
      codigo: 'requires_cantidad',
      tipo: 'REQUIRES_INPUT',
      campo: 'cantidad',
      mensaje: 'Falta declarar cantidad',
    },
  ],
  paramsPasoSchema: [],
  productosTipicos: ['Letras corpóreas', 'Tazas personalizadas', 'Remeras DTG'],
};

const impresion_3d: DefinicionFamilia = {
  codigo: 'impresion_3d',
  nombre: 'Impresión 3D',
  categoria: 'produccion_impresion',
  descripcion:
    'Fabricación aditiva por filamento (FDM) o resina. El tiempo sale del caudal del perfil aplicado a los gramos de la pieza; si el taller ya tiene las horas del slicer, las carga a mano (T-4).',
  relacionMaquinaSoportada: ['M-1', 'M-2'],
  // T-3: caudal del perfil (g/h) sobre los gramos de la pieza.
  // T-4: el comercial carga las horas exactas del slicer — el caso del taller
  //      que sliceó la pieza antes de cotizar, que es el dato más fiel.
  modosTiempoSoportados: ['T-3', 'T-4'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  // La magnitud NO es el área ni la caja de la pieza: dos piezas del mismo
  // tamaño consumen distinto según relleno y paredes. Son los gramos.
  magnitudTiempoDefault: 'gramos_material',
  slotsRequeridos: [
    {
      codigo: 'material_3d',
      nombre: 'Filamento / resina',
      tipo: 'SUSTRATO',
      requerido: true,
      compatibilidadMaterial: MP.aditiva3d,
    },
  ],
  permiteSlotsAdicionales: true,
  plantillasCompatibles: ['IMPRESORA_3D'],
  tiposPerfilCompatibles: ['FABRICACION'],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_impresas', 'tiempo_real_impresion'],
  validaciones: [
    {
      codigo: 'requires_cantidad',
      tipo: 'REQUIRES_INPUT',
      campo: 'cantidad',
      mensaje: 'Falta declarar cantidad',
    },
  ],
  paramsPasoSchema: [
    {
      campo: 'gramosPorPieza',
      etiqueta: 'Gramos por pieza',
      tipo: 'number',
      requerido: false,
      descripcion:
        'Material que consume UNA pieza, según el slicer. Es la magnitud del tiempo (gramos ÷ caudal del perfil). Conviene dejarlo abierto al comercial: cambia con cada modelo.',
    },
    {
      campo: 'rellenoPct',
      etiqueta: 'Relleno (%)',
      tipo: 'number',
      requerido: false,
      descripcion:
        'Densidad de relleno del slicer. Informativo para producción: el consumo real ya viaja en los gramos por pieza.',
    },
  ],
  productosTipicos: [
    'Prototipos y maquetas',
    'Piezas de repuesto',
    'Souvenirs y trofeos impresos',
  ],
};

const aplicacion_transfer: DefinicionFamilia = {
  codigo: 'aplicacion_transfer',
  // Renombrada 2026-08-07 (pedido del usuario): el nombre viejo ("Aplicación
  // DTF UV manual") ataba la familia a UNA técnica; aplica a cualquier
  // transfer colocado a mano. El par con la hermana queda simétrico:
  // "de transfer manual" / "de transfer textil".
  nombre: 'Aplicación de transfer manual',
  categoria: 'produccion_impresion',
  descripcion:
    'Aplicación MANUAL del transfer sobre objetos (DTF UV sobre tazas, botellas, rígidos) — sin plancha térmica. El planchado sobre prenda con máquina vive en "Aplicación de transfer textil".',
  // Solo manual (M-0). Lo que lleva plancha térmica (M-1) es la familia
  // aplicacion_transfer_textil.
  relacionMaquinaSoportada: ['M-0'],
  // T-2 = productividad propia (X piezas/h a mano).
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'HEREDAR_DEL_OUTPUT_CANONICO',
  ],
  modosActivacionSoportados: ['OBLIGATORIO'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'textil',
      nombre: 'Objeto base',
      tipo: 'SUSTRATO',
      requerido: true,
      // Acepta objeto (taza/botella) o rígido. Su costo entra por unidad
      // (formula por_pieza).
      compatibilidadMaterial: MP.sustratoPieza,
    },
    {
      codigo: 'film_transfer',
      nombre: 'Film transfer impreso (comprado listo)',
      tipo: 'INSUMO_PASO',
      // OPCIONAL: solo se completa si se compra el transfer ya impreso. Si el
      // film se imprime en un paso previo (impresion_por_area con tecnologia
      // DTF_UV), su costo ya está ahí — dejar este slot vacío para no duplicarlo.
      requerido: false,
      compatibilidadMaterial: MP.filmTransfer,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_aplicadas'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: ['Tazas DTF UV', 'Botellas personalizadas'],
};

const aplicacion_transfer_textil: DefinicionFamilia = {
  codigo: 'aplicacion_transfer_textil',
  nombre: 'Aplicación de transfer textil',
  categoria: 'produccion_impresion',
  descripcion:
    'Planchado del transfer sobre la prenda con PLANCHA TÉRMICA (M-1): DTF textil, sublimación, vinilo textil, serigrafía-transfer. El film ya viene impreso de un paso previo (gran formato) o se compra listo.',
  // Con máquina: la plancha térmica. El tiempo sale del perfil (T-3).
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'HEREDAR_DEL_OUTPUT_CANONICO',
  ],
  modosActivacionSoportados: ['OBLIGATORIO'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'prenda',
      nombre: 'Prenda / sustrato textil',
      tipo: 'SUSTRATO',
      requerido: true,
      // Remera, buzo, etc. Su costo entra por unidad (formula por_pieza).
      compatibilidadMaterial: MP.sustratoPieza,
    },
    {
      codigo: 'film_transfer',
      nombre: 'Film transfer impreso (comprado listo)',
      tipo: 'INSUMO_PASO',
      // OPCIONAL: solo si se compra el transfer ya impreso. Si el film se imprime
      // en un paso previo (impresion_por_area con tecnologia DTF_TEXTIL/SUBLIMACION),
      // su costo ya está ahí — dejar este slot vacío para no duplicarlo.
      requerido: false,
      compatibilidadMaterial: MP.filmTransfer,
    },
  ],
  permiteSlotsAdicionales: false,
  // La APLICACIÓN se hace con plancha térmica; la productividad sale de su
  // perfil operativo (piezas/hora, derivada del ciclo de prensado).
  plantillasCompatibles: ['PLANCHA_TERMICA'],
  tiposPerfilCompatibles: ['FABRICACION'],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_aplicadas'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: ['Remeras estampadas', 'Buzos con logo', 'Camperas'],
};

const grabado_laser: DefinicionFamilia = {
  codigo: 'grabado_laser',
  nombre: 'Grabado láser',
  categoria: 'produccion_impresion',
  descripcion:
    'Grabado superficial con láser sobre acrílico, madera, metal, cuero. NO atraviesa el material.',
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-3', 'T-4'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OBLIGATORIO'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  // Grabado VECTORIAL por RECORRIDO (perfil en mm/s, misma unidad que el corte en
  // la máquina láser). Un grabado raster de relleno usa T-4 manual.
  magnitudTiempoDefault: 'perimetro_piezas_m',
  slotsRequeridos: [
    {
      codigo: 'sustrato',
      nombre: 'Sustrato a grabar',
      tipo: 'SUSTRATO',
      requerido: true,
      compatibilidadMaterial: MP.sustratoGrabable,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: ['CORTE_LASER'],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_grabadas'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: ['Llaveros, placas, cuadros decorativos'],
};

// ============================================================================
// 3.3 Corte y formado (7)
// ============================================================================

const corte_guillotina: DefinicionFamilia = {
  codigo: 'corte_guillotina',
  // [P1] Antes: rama corte_guillotina en el T-3 del motor.
  primitivas: {
    tiempoRun: 'guillotina_por_cortes',
    seleccionPerfil: 'escalon_gramaje',
  },
  // [Etapa F3] Antes: switch defaultOutputParaHeredar en motor.service.
  outputHeredadoDefault: 'pliegos_impresos',
  nombre: 'Corte con guillotina',
  categoria: 'corte_y_formado',
  descripcion:
    'Corte de pliegos en piezas. Tiempo compuesto: tandas × cortes/tanda.',
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: ['HEREDAR_DEL_OUTPUT_CANONICO'],
  modosActivacionSoportados: ['OBLIGATORIO'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: ['GUILLOTINA'],
  inputsRequeridos: [],
  outputsCanonicos: ['piezas_cortadas'],
  validaciones: [
    {
      codigo: 'existe_pliegos',
      tipo: 'EXISTS_OUTPUT',
      outputCanonico: 'pliegos_calculados',
      // Desde la Etapa A la imposición la hace el paso que imprime (pre-prensa
      // ya no la publica). Si esto salta, lo más probable es que la impresión
      // no haya podido acomodar la pieza en el pliego.
      mensaje:
        'Guillotina necesita los pliegos calculados por el paso de impresión ' +
        'y ningún paso anterior los publicó. Revisá que la imposición haya ' +
        'podido acomodar la pieza en el pliego configurado.',
    },
    {
      // El run sale de los cortes, no de la productividad: sin cortes el
      // paso costaba 0 minutos en silencio. Pasa cuando el trabajo lleva
      // más de una medida y el acomodo deja de ser una grilla.
      codigo: 'existe_cortes',
      tipo: 'EXISTS_OUTPUT',
      outputCanonico: 'cortes_calculados',
      mensaje:
        'Guillotina no puede calcular el tiempo: la imposición del paso de ' +
        'impresión no dejó una grilla de columnas por filas, así que no hay ' +
        'cortes que contar. Suele pasar cuando el trabajo tiene piezas de ' +
        'medidas distintas en el mismo pliego.',
    },
  ],
  paramsPasoSchema: [],
  productosTipicos: ['Tarjetas de Visita', 'Talonarios', 'Folletería'],
};

const plotter_corte: DefinicionFamilia = {
  codigo: 'plotter_corte',
  nombre: 'Plotter de corte',
  categoria: 'corte_y_formado',
  // [Etapa F] Antes: caso 2 del dispatcher, ruteado por familiaCodigo.
  nestingConfig: {
    superficie: 'rollo',
    estrategia: 'corte_rollo',
    fallbackSinLayout: 'm2_crudos',
  },
  descripcion:
    'Corte de vinilo o papel adhesivo con plotter (Skycut, Roland). Soporta medio corte / corte profundo / corte completo.',
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: ['CALCULADO_POR_PASO'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  // Slot de sustrato OPCIONAL: el plotter corta un material flexible PROPIO
  // (vinilo, esmerilado o imán en rollo) o troquela lo que imprimió un paso anterior
  // (heredado, sin sustrato propio ni costo de material). Sin configurar el
  // slot, la conducta es la de siempre (nestea sobre el ancho de la máquina).
  // Ver docs/corte-sustrato-propio-o-heredado-diseno.md §7.
  slotsRequeridos: [
    {
      codigo: 'sustrato_corte',
      nombre: 'Material flexible a cortar (opcional)',
      tipo: 'SUSTRATO',
      requerido: false,
      compatibilidadMaterial: MP.materialFlexibleCortable,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [
    'PLOTTER_DE_CORTE',
    'IMPRESORA_GRAN_FORMATO_POR_AREA',
  ],
  // Corta, no imprime: sobre una impresora con corte integrado usa el perfil
  // de corte y no factura tinta. [Etapa A]
  tiposPerfilCompatibles: ['CORTE', 'MIXTO'],
  sinConsumiblesMaquina: true,
  // Gran formato: 5 mm de aire entre piezas si nadie configuró otra cosa.
  // [Etapa A: era `defaultSeparationForFamily`]
  separacionNestingDefaultMm: 5,
  // La geometría a cortar sale de las piezas del trabajo (default, que preserva
  // la conducta actual) o de los pliegos que imprimió un paso anterior
  // (troquela lo impreso). Mismo mecanismo que montaje_sobre_sustrato.
  fuentesPiezasNesting: {
    pliegos_impresos: {
      cantidadDesde: ['pliegos_impresos', 'pliegos_calculados'],
      anchoDesde: 'pliego_impresion_ancho_mm',
      altoDesde: 'pliego_impresion_alto_mm',
    },
  },
  fuentePiezasDefault: 'piezas_jobcontext',
  inputsRequeridos: ['piezas'],
  outputsCanonicos: ['piezas_cortadas', 'metros_lineales_corte'],
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'tipoCorte',
      etiqueta: 'Tipo de corte',
      tipo: 'enum',
      valoresPermitidos: ['MEDIO', 'PROFUNDO', 'COMPLETO'],
      default: 'MEDIO',
      requerido: false,
      descripcion:
        'Profundidad del corte. MEDIO para stickers (no atraviesa el papel base), COMPLETO para cortar el vinilo entero.',
    },
  ],
  productosTipicos: ['Stickers', 'Vinilo de corte', 'Calcomanías'],
};

const corte_laser: DefinicionFamilia = {
  codigo: 'corte_laser',
  nombre: 'Corte láser',
  categoria: 'corte_y_formado',
  descripcion:
    'Corte de placas (acrílico, madera, MDF, etc.) con láser. Atraviesa el material (distinto a grabado).',
  relacionMaquinaSoportada: ['M-1'],
  // Siempre calcula el recorrido con la velocidad del perfil operativo de la
  // máquina. No admite tiempo fijo/manual como modo del paso.
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'CALCULADO_POR_PASO',
  ],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  // El tiempo T-3 se mide por RECORRIDO: el perfil trae la velocidad (mm/s) y el
  // motor la aplica al perímetro de las piezas.
  magnitudTiempoDefault: 'perimetro_piezas_m',
  nestingConfig: {
    superficie: 'pliegos_multiples',
    estrategia: 'irregular_placa',
    guardSinLayout: 'sustrato',
  },
  origenMargenesNesting: {
    fuente: 'material',
    campo: 'margenNoUtilizableMm',
    forma: 'uniforme',
  },
  slotsRequeridos: [
    {
      codigo: 'sustrato_corte',
      nombre: 'Placa a cortar (opcional)',
      tipo: 'SUSTRATO',
      requerido: false,
      compatibilidadMaterial: MP.sustratoCorteVectorial,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: ['CORTE_LASER'],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_cortadas', 'tiempo_real_corte'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: ['Letras de acrílico', 'Cortes complejos en MDF/madera'],
};

const troquelado_digital: DefinicionFamilia = {
  codigo: 'troquelado_digital',
  // [Etapa F3] Antes: switch defaultOutputParaHeredar en motor.service.
  outputHeredadoDefault: 'pliegos_impresos',
  nombre: 'Troquelado digital',
  categoria: 'corte_y_formado',
  descripcion: 'Mesa de corte digital tipo Esko/Zund. Sustrato en hoja.',
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: ['MESA_DE_CORTE'],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_troqueladas'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: [
    'Cajas con forma especial',
    'Stickers troquelados grandes',
  ],
};

const cnc: DefinicionFamilia = {
  codigo: 'cnc',
  nombre: 'CNC',
  categoria: 'corte_y_formado',
  descripcion:
    'Router CNC para piezas planas (3D fuera de scope hoy). Cortes complejos en MDF, PVC, foam.',
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-3', 'T-4'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'CALCULADO_POR_PASO',
  ],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  // El tiempo T-3 se mide por RECORRIDO: el perfil trae la velocidad (mm/min, feed
  // rate) y el motor la aplica al perímetro de las piezas. Fresado/desbaste o
  // formas caladas usan T-4 manual.
  magnitudTiempoDefault: 'perimetro_piezas_m',
  nestingConfig: {
    superficie: 'pliegos_multiples',
    estrategia: 'irregular_placa',
    guardSinLayout: 'sustrato',
  },
  origenMargenesNesting: {
    fuente: 'material',
    campo: 'margenNoUtilizableMm',
    forma: 'uniforme',
  },
  slotsRequeridos: [
    {
      codigo: 'sustrato_corte',
      nombre: 'Placa a cortar (opcional)',
      tipo: 'SUSTRATO',
      requerido: false,
      compatibilidadMaterial: MP.sustratoCorteVectorial,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: ['ROUTER_CNC'],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_cortadas'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: ['Letras corpóreas MDF', 'Carteles rígidos con forma'],
};

const plegado: DefinicionFamilia = {
  codigo: 'plegado',
  // [Etapa F3] Antes: switch defaultOutputParaHeredar en motor.service.
  outputHeredadoDefault: 'pliegos_impresos',
  nombre: 'Plegado manual',
  categoria: 'corte_y_formado',
  // MANUAL: sin máquina (M-0) y con productividad propia (T-2). Antes tenía M-1/T-3
  // por herencia, pero es inconsistente con "manual".
  descripcion: 'Plegado de pliegos para folletos, dípticos, trípticos.',
  visibleEnSelector: false,
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['HEREDAR_DEL_OUTPUT_CANONICO'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['pliegos_plegados'],
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'tipoPliegue',
      etiqueta: 'Tipo de pliegue',
      tipo: 'enum',
      valoresPermitidos: ['simple', 'ventana', 'acordeon', 'cruzado'],
      requerido: false,
    },
  ],
  productosTipicos: ['Folletos plegados', 'Dípticos', 'Trípticos'],
};

const corte_manual: DefinicionFamilia = {
  codigo: 'corte_manual',
  // [Tanda C] Antes: defaults cableados por nombre en el editor.
  mecanismoCantidadDefault: 'HEREDAR_DEL_OUTPUT_CANONICO',
  // [Etapa F3] Antes: switch defaultOutputParaHeredar en motor.service.
  outputHeredadoDefault: 'pliegos_impresos',
  nombre: 'Corte manual',
  categoria: 'corte_y_formado',
  descripcion:
    'Corte manual con trincheta, regla o sierra. Puede acomodar piezas sobre un rollo flexible y calcular el material consumido sin asignar una máquina.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'HEREDAR_DEL_OUTPUT_CANONICO',
    'CALCULADO_POR_PASO',
  ],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  nestingConfig: {
    superficie: 'segun_material',
    fallbackSinLayout: 'm2_crudos',
  },
  slotsRequeridos: [
    {
      codigo: 'sustrato_corte',
      nombre: 'Material flexible a cortar (opcional)',
      tipo: 'SUSTRATO',
      requerido: false,
      compatibilidadMaterial: MP.materialFlexibleCortable,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_cortadas'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: [
    'Vinilo esmerilado con cortes rectos',
    'Señalética PVC chica',
    'MDF fino',
  ],
};

/** Corte de piezas corpóreas a partir de contornos vectoriales sobre placas.
 * El SVG y su nesting son requisitos del PROCESO: cualquier producto cuya
 * ruta use esta familia obtiene el configurador vectorial sin activar una
 * herramienta particular en atributos comerciales. */
const corte_hilo_caliente: DefinicionFamilia = {
  codigo: 'corte_hilo_caliente',
  nombre: 'Corte con hilo caliente',
  categoria: 'corte_y_formado',
  descripcion:
    'Corte de Polyfan y espumas rígidas desde geometría vectorial, con nesting irregular sobre placas.',
  herramientasCotizacion: ['diseno_vectorial'],
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: ['CALCULADO_POR_PASO'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  magnitudTiempoDefault: 'perimetro_piezas_m',
  ritmoDefault: {
    unidad: 'mm_min',
    modoCalculo: 'productivity',
    fuenteCantidad: 'perimetro_piezas_m',
  },
  nestingConfig: {
    superficie: 'pliegos_multiples',
    estrategia: 'irregular_placa',
    guardSinLayout: 'sustrato',
  },
  origenMargenesNesting: {
    fuente: 'material',
    campo: 'margenNoUtilizableMm',
    forma: 'uniforme',
  },
  separacionNestingDefaultMm: 5,
  // En hilo caliente, 5 mm es aire de seguridad entre cortes. No agranda la
  // pieza ni debe sumarse a los márgenes físicos de la placa.
  semanticaSeparacion: 'literal',
  slotsRequeridos: [
    {
      codigo: 'sustrato_corte',
      nombre: 'Placa para hilo caliente',
      tipo: 'SUSTRATO',
      requerido: true,
      compatibilidadMaterial: MP.sustratoCorteVectorial,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: ['CORTE_HILO_CALIENTE'],
  inputsRequeridos: ['cantidad', 'disenoVectorialFuente'],
  outputsCanonicos: ['piezas_cortadas'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: [
    'Letras corpóreas en Polyfan',
    'Logos y formas corpóreas en espuma rígida',
  ],
};

// ============================================================================
// 3.4 Terminaciones (3)
// ============================================================================

const laminado: DefinicionFamilia = {
  codigo: 'laminado',
  // [Etapa F3] Antes: switch defaultOutputParaHeredar en motor.service.
  outputHeredadoDefault: 'pliegos_impresos',
  nombre: 'Laminado Polipropileno',
  categoria: 'terminaciones',
  // [Etapa F] Antes: caso 3 del dispatcher, ruteado por familiaCodigo.
  nestingConfig: {
    superficie: 'rollo',
    estrategia: 'laminado_rollo',
    guardSinLayout: 'laminado_rollo',
  },
  descripcion:
    'Aplicación de film BOPP (mate, brillo, texturado) con laminadora.',
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: [
    'HEREDAR_DEL_OUTPUT_CANONICO',
    'DIRECT_FROM_JOBCONTEXT',
  ],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: ['caras'],
  slotsRequeridos: [
    {
      codigo: 'film',
      nombre: 'Film de laminado',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.laminadoFilm,
      // El nesting de laminado calcula metros de film: la fórmula no es
      // configurable. [Etapa A]
      formulaForzada: 'por_metro_lineal',
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: ['LAMINADORA_BOPP_ROLLO'],
  // El film se desperdicia en los bordes, no hay "área no imprimible": la
  // laminadora declara su desperdicio en su propio campo, y el paso entre
  // pliegos es la separación. Sin datos de máquina, todo en cero: el film
  // arranca y termina pegado al pliego.
  // [Etapa A: eran tres if por familia en nesting-config]
  origenMargenesNesting: { fuente: 'maquina', campo: 'margenesDesperdicioMm' },
  campoSeparacionMaquina: 'margenEntrePliegosMm',
  // Lo que se lamina es el PLIEGO impreso, no la pieza terminada: el film
  // pasa por la hoja entera. Una sola fuente, sin decisión del modelador.
  // [Etapa A: estaba cableado en runLaminadoRollo]
  fuentesPiezasNesting: {
    pliegos_impresos: {
      cantidadDesde: ['pliegos_impresos'],
      anchoDesde: 'pliego_impresion_ancho_mm',
      altoDesde: 'pliego_impresion_alto_mm',
    },
  },
  fuentePiezasDefault: 'pliegos_impresos',
  margenesNestingDefault: {
    leftMm: 0,
    rightMm: 0,
    topMm: 0,
    bottomMm: 0,
    startMm: 0,
    endMm: 0,
  },
  inputsRequeridos: [],
  outputsCanonicos: ['piezas_laminadas', 'metros_lineales_film'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: ['Tarjetas Premium', 'Vinilo plastificado', 'Cuadros'],
};

const plastificado_pouch: DefinicionFamilia = {
  codigo: 'plastificado_pouch',
  nombre: 'Plastificado pouch',
  categoria: 'terminaciones',
  // [Etapa F] Antes: caso 4 del dispatcher, ruteado por familiaCodigo.
  nestingConfig: {
    superficie: 'pliego',
    estrategia: 'pouch',
    guardSinLayout: 'pouch',
  },
  descripcion:
    'Plastificado térmico en pouch A4/A3 con acomodo de piezas y corte posterior.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['CALCULADO_POR_PASO'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'pouch',
      nombre: 'Pouch térmico',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.laminadoPouch,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  // El pouch es un formato cerrado: el borde sellado no sirve y lo declara el
  // MATERIAL (un solo número para los cuatro lados), no la máquina. Y acá no
  // hay refile: la separación que carga el modelador es aire entre piezas, se
  // usa tal cual. [Etapa A: eran cuatro if por familia en nesting-config]
  origenMargenesNesting: {
    fuente: 'material',
    campo: 'margenNoUsableMm',
    forma: 'uniforme',
  },
  margenesNestingDefault: { leftMm: 0, rightMm: 0, topMm: 0, bottomMm: 0 },
  semanticaSeparacion: 'literal',
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_laminadas'],
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'separacionEntrePiezasMm',
      etiqueta: 'Separación entre piezas',
      tipo: 'number',
      requerido: false,
      default: 0,
    },
  ],
  productosTipicos: [
    'Credenciales plastificadas',
    'Menús plastificados',
    'Tarjetas rígidas pouch',
  ],
};

const pintura_superficial: DefinicionFamilia = {
  codigo: 'pintura_superficial',
  nombre: 'Pintura superficial',
  categoria: 'terminaciones',
  descripcion: 'Pintura, laca o barniz protector sobre piezas rígidas.',
  // M-0 puro (decisión 2026-08-11): pintar es oficio de taller — soplete o
  // rodillo, sin máquina que exigir ni perfil que resolver. T-3 se va con
  // la máquina (era letra muerta: cero configs lo usaban).
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'HEREDAR_DEL_OUTPUT_CANONICO',
  ],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'pintura',
      nombre: 'Pintura / laca',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.pintura,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_pintadas'],
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'variante',
      etiqueta: 'Tipo de acabado',
      tipo: 'enum',
      valoresPermitidos: ['mate', 'brillo', 'satinado'],
      requerido: false,
    },
  ],
};

// ============================================================================
// 3.5 Encuadernación / armado (2)
// ============================================================================

const abrochado_caballete: DefinicionFamilia = {
  codigo: 'abrochado_caballete',
  nombre: 'Abrochado a caballete',
  categoria: 'encuadernacion_armado',
  descripcion:
    'Broches al lomo de un cuadernillo anidado (revista, folleto multipágina). Requiere que el paso de impresión haya corrido la imposición de cuadernillo (docs/imposicion-cuadernillos-diseno.md).',
  // Manual (abrochadora de mesa) por ahora: cuando haya plantilla de
  // abrochadora eléctrica se suma M-1 sin tocar el resto.
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: true,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['libros_abrochados'],
  validaciones: [
    {
      codigo: 'existe_imposicion_cuadernillo',
      tipo: 'EXISTS_OUTPUT',
      outputCanonico: 'hojas_por_libro',
      mensaje:
        'El abrochado a caballete necesita la imposición de cuadernillo del ' +
        'paso de impresión (ningún paso anterior publicó hojas por libro). ' +
        'Activá "Imposición: cuadernillo a caballete" en el paso de impresión.',
    },
  ],
  paramsPasoSchema: [
    {
      campo: 'brochesPorLibro',
      etiqueta: 'Broches por libro',
      tipo: 'number',
      default: 2,
      requerido: false,
      descripcion: 'Cantidad de broches al lomo por ejemplar (típico: 2).',
    },
  ],
  productosTipicos: ['Revistas', 'Folletos multipágina', 'Catálogos finos'],
};

const encuadernado_anillado: DefinicionFamilia = {
  codigo: 'encuadernado_anillado',
  // [Etapa F3] Antes: switch defaultOutputParaHeredar en motor.service.
  outputHeredadoDefault: 'pliegos_impresos',
  nombre: 'Encuadernación con anillo (espiral / wire-o)',
  categoria: 'encuadernacion_armado',
  descripcion:
    'Anillado plástico o wire-o con máquina anilladora. Motor elige variante de anillo por capacidad.',
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: ['hojasPorLibro'],
  slotsRequeridos: [
    {
      codigo: 'anillo',
      nombre: 'Anillo (variante por capacidad)',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.anillo,
    },
    // Tapa frontal (acetato/PVC transparente) + contratapa (cartón). Se consumen
    // 1 por libro (como el anillo); el centro de copiado las resuelve por tamaño
    // del documento y las pinnea por slotMateriales. Opcionales a nivel motor
    // (no rompen si el tenant no cargó tapas), pero el CC siempre las incluye.
    {
      codigo: 'tapa_frontal',
      nombre: 'Tapa frontal (transparente)',
      tipo: 'TAPA',
      requerido: false,
      compatibilidadMaterial: MP.tapa,
    },
    {
      codigo: 'tapa_posterior',
      nombre: 'Contratapa (cartón)',
      tipo: 'TAPA',
      requerido: false,
      compatibilidadMaterial: MP.tapa,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad', 'hojasPorLibro'],
  outputsCanonicos: ['libros_anillados'],
  validaciones: [
    {
      codigo: 'anillo_soporta_hojas',
      tipo: 'COMPARE',
      campoJobContext: 'hojasPorLibro',
      fuenteB: 'MATERIAL',
      campoB: 'capacidadMaxHojas',
      operador: '<=',
      slotMaterial: 'anillo',
      mensaje:
        'Hojas por libro ({jc.hojasPorLibro}) excede capacidad del anillo ({mat.capacidadMaxHojas})',
    },
  ],
  paramsPasoSchema: [],
};

const engomado_emblocado: DefinicionFamilia = {
  codigo: 'engomado_emblocado',
  // [Etapa F3] Antes: switch defaultOutputParaHeredar en motor.service.
  outputHeredadoDefault: 'pliegos_impresos',
  nombre: 'Engomado / emblocado',
  categoria: 'encuadernacion_armado',
  descripcion:
    'Aplicación de cola/goma en lomo de blocks (talonarios). Manual, sin máquina.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'cola',
      nombre: 'Cola / goma',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.adhesivo,
    },
    {
      codigo: 'carton_base',
      nombre: 'Cartón base (opcional)',
      tipo: 'INSUMO_PASO',
      requerido: false,
      compatibilidadMaterial: MP.cartonBase,
    },
    {
      codigo: 'hoja_blanca_superior',
      nombre: 'Hoja blanca superior (opcional)',
      tipo: 'INSUMO_PASO',
      requerido: false,
      compatibilidadMaterial: MP.sustratoHoja,
    },
    {
      codigo: 'tapa_cartulina',
      nombre: 'Tapa cartulina (opcional)',
      tipo: 'TAPA',
      requerido: false,
      compatibilidadMaterial: MP.tapa,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['blocks_emblocados'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: ['Talonarios'],
};

// ============================================================================
// 3.6 Estructural / montaje físico (2)
// ============================================================================

const ensamble_estructural: DefinicionFamilia = {
  codigo: 'ensamble_estructural',
  nombre: 'Ensamble estructural',
  categoria: 'estructural_montaje',
  descripcion: 'Ensamble de piezas con tornillos, herrajes, perfiles.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-1', 'T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OBLIGATORIO'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: true,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['piezas_ensambladas'],
  validaciones: [],
  paramsPasoSchema: [],
};

const estructura_bastidor: DefinicionFamilia = {
  codigo: 'estructura_bastidor',
  // [Tanda B] Antes: FAMILIAS_CON_PARAMS_EDITABLES en el frontend.
  editorParamsGenerico: true,
  nombre: 'Estructura de bastidor',
  categoria: 'estructural_montaje',
  descripcion:
    'Corte de los hierros del bastidor (backlight, frontlight) + derivación geométrica: publica ml, puntos de soldadura y m² de cenefa/fondo/pintura como outputs que los pasos siguientes HEREDAN (soldadura, pintura, cenefas — docs/carteleria-configurador-diseno.md §15).',
  // Herrería manual por ahora; cuando haya plantilla de soldadora se suma M-1.
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2', 'T-3'],
  // CALCULADO_POR_PASO: la cantidad del paso son los ml de perfil derivados.
  mecanismosCantidadSoportados: ['CALCULADO_POR_PASO'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'perfil_estructural',
      nombre: 'Perfil / caño estructural',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.soldadura,
      // El consumo son los ml derivados; si la variante declara `largoBarra`,
      // el despiece del derivador se empaqueta en barras enteras.
      formulaForzada: 'por_unidad_productiva',
      magnitudDerivada: 'mlTotal',
    },
    {
      codigo: 'anclaje',
      nombre: 'Anclajes (opcional)',
      tipo: 'INSUMO_PASO',
      requerido: false,
      compatibilidadMaterial: {
        familiasMateriaPrima: ['HERRAJE_ACCESORIO'],
        subfamiliasMateriaPrima: [
          'SISTEMA_COLGADO_MONTAJE',
          'FIJACION_AUXILIAR',
        ],
      },
      // Pares de soportes cada ~80 cm de ancho (los deriva el bastidor).
      magnitudDerivada: 'anclajes',
    },
  ],
  permiteSlotsAdicionales: true,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: [
    'ml_estructura',
    'puntos_soldadura',
    // Alias material-agnóstico del mismo driver: en madera las uniones son
    // grampas/escuadras, no soldaduras. `puntos_soldadura` queda por compat
    // con las herencias guardadas (regla: alias de lectura, no migración).
    'uniones_estructura',
    'cenefa_m2',
    'pintura_m2',
    'fondo_m2',
  ],
  derivador: {
    codigo: 'bastidor_rectangular',
    magnitudPrincipal: 'mlTotal',
    unidadPrincipal: 'ml de perfil',
    // El lado del caño (seccion "20×20 mm") define los largos de corte de
    // las barras interiores; el desarrolloSeccion, la pintura por metro.
    materialSlot: 'perfil_estructural',
    magnitudesTiempo: [
      { magnitud: 'cortes', etiqueta: 'cortes de hierro' },
      { magnitud: 'puntosSoldadura', etiqueta: 'uniones (soldadura/grampas)' },
    ],
    outputs: {
      ml_estructura: 'mlTotal',
      puntos_soldadura: 'puntosSoldadura',
      uniones_estructura: 'puntosSoldadura',
      cenefa_m2: 'cenefaM2',
      pintura_m2: 'pinturaM2',
      fondo_m2: 'fondoM2',
    },
    // Geometría que publica al JobContext para los pasos siguientes (Ola #2):
    // el interior útil (para que el LED siembre sobre 96, no 100) y la lona
    // bruta. Los siguientes la leen con prioridad sobre la medida exterior.
    publicaCanon: {
      interiorMm: 'interior',
      lonaBrutaMm: 'lonaBruta',
      // Para que un paso posterior (chapa, cenefa) los elija como fuente de
      // medida y panelice sobre su chapa. docs/fuente-de-medida-de-consumo-diseno.md
      fondoMm: 'fondo',
      cenefaTirasMm: 'cenefaTiras',
    },
    mensajeSinDatos:
      'es un bastidor DOBLE (cajón) pero no tiene profundidad: sin ella no se pueden derivar los metros de perfil.',
    sugerenciaSinDatos:
      'Cargá la profundidad del cajón al cotizar, fijala en el paso, o cambiá el bastidor a "simple" si es un marco plano.',
    codigoSinDatos: 'estructura_bastidor_sin_profundidad',
  },
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'tipoBastidor',
      etiqueta: 'Tipo de bastidor',
      tipo: 'enum',
      valoresPermitidos: ['simple', 'doble'],
      default: 'doble',
      requerido: true,
      descripcion:
        'Simple: un marco plano (frontlight). Doble: cajón con frente y contra unidos por la profundidad (backlight).',
    },
    {
      campo: 'sepRefuerzoVcm',
      etiqueta: 'Separación máx. refuerzos verticales (cm)',
      tipo: 'number',
      default: 100,
      requerido: false,
      descripcion: 'Cada cuántos cm va una barra vertical. 0 = sin refuerzos.',
      expuestoAlComercial: true,
    },
    {
      campo: 'sepRefuerzoHcm',
      etiqueta: 'Separación máx. refuerzos horizontales (cm)',
      tipo: 'number',
      default: 0,
      requerido: false,
      expuestoAlComercial: true,
    },
    {
      campo: 'solapaCenefaCm',
      etiqueta: 'Solapa del plegado (cm por lado)',
      tipo: 'number',
      default: 2,
      requerido: false,
      expuestoAlComercial: true,
    },
    {
      campo: 'profundidadMm',
      etiqueta: 'Profundidad fija del cajón (mm)',
      tipo: 'number',
      requerido: false,
      descripcion:
        'Si el producto tiene profundidad fija. Si el comercial la carga al cotizar, manda la del trabajo.',
    },
    // Criterios de TALLER que antes eran constantes del código (regla 1 del
    // ejercicio, carteleria-pasos-revision.md §8): el default conserva el
    // valor histórico — nada se mueve de precio hasta que un taller lo toque.
    {
      campo: 'sepAnclajeCm',
      etiqueta: 'Anclajes: un par cada (cm de ancho)',
      tipo: 'number',
      default: 80,
      requerido: false,
      descripcion:
        'Criterio de instalación: cada cuántos cm de ancho va un par de anclajes (mínimo 2 pares). El slot Anclajes puede pisarlo con su propia regla.',
    },
    {
      campo: 'margenPinturaPct',
      etiqueta: 'Pérdida de pintura (%)',
      tipo: 'number',
      default: 10,
      requerido: false,
      descripcion:
        'Se suma a los m² de desarrollo del perfil que hereda el paso de pintura.',
    },
    {
      campo: 'desperdicioCenefaPct',
      etiqueta: 'Desperdicio de cenefa (%)',
      tipo: 'number',
      default: 8,
      requerido: false,
      descripcion:
        'Se suma a los m² del desarrollo de la cenefa (plegado y recortes).',
    },
    // Lona bruta (Ola #1, docs/estructura-bastidor-outputs-diseno.md §7.1). Hoy
    // sólo alimentan la geometría de la traza; la conexión al paso de lona es la
    // Ola #2. Aditivos con default histórico → no mueven precios.
    {
      campo: 'montajeLona',
      etiqueta: 'Montaje de la lona',
      tipo: 'enum',
      valoresPermitidos: ['perimetral', 'contramarco'],
      default: 'perimetral',
      requerido: false,
      descripcion:
        'Perimetral: tensada al ras con tornillos (backlight). Contramarco: envuelve la profundidad y se engrampa atrás (tela canvas).',
    },
    {
      campo: 'demasiaAgarreCm',
      etiqueta: 'Demasía de agarre de la lona (cm por lado)',
      tipo: 'number',
      default: 10,
      requerido: false,
      descripcion:
        'Lona extra por lado para pinzar y tensar. El corte final al ras del hierro es merma, no material.',
    },
  ],
  productosTipicos: [
    'Cartel backlight',
    'Cartel frontlight',
    'Marquesina',
    'Estructura de valla',
  ],
};

const iluminacion_led: DefinicionFamilia = {
  codigo: 'iluminacion_led',
  // [Tanda B] Antes: FAMILIAS_CON_PARAMS_EDITABLES en el frontend.
  editorParamsGenerico: true,
  nombre: 'Iluminación LED',
  categoria: 'estructural_montaje',
  descripcion:
    'Sembrado de módulos LED + fuente + cableado para cartelería luminosa. La cantidad de módulos se DERIVA de la geometría (por área o por recorrido) y de los atributos del módulo elegido; la fuente se elige sola por capacidad (docs/carteleria-configurador-diseno.md §4.2).',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['CALCULADO_POR_PASO'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL', 'CONDICIONAL'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      // PRIMERO a propósito: es el slot principal (materialPreliminar) y sus
      // atributos (coberturaM2/pasoMm/wattsModulo) definen la cantidad.
      codigo: 'modulos_led',
      nombre: 'Módulo LED',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: {
        familiasMateriaPrima: ['ELECTRONICA_CARTELERIA', 'NEON_LUMINARIA'],
        subfamiliasMateriaPrima: ['MODULO_LED_CARTELERIA', 'NEON_FLEX_LED'],
      },
      formulaForzada: 'por_unidad_productiva',
    },
    {
      codigo: 'fuente',
      nombre: 'Fuente de alimentación (auto por capacidad)',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: {
        familiasMateriaPrima: ['ELECTRONICA_CARTELERIA'],
        subfamiliasMateriaPrima: ['FUENTE_ALIMENTACION_LED'],
      },
      // Una fuente por cartel; la variante la elige el selector por capacidad
      // contra los watts derivados (margen ×1,3 ya incluido en la magnitud).
      cantidadFija: 1,
      criterioCapacidadDefault: {
        inputMagnitud: 'wattsRequeridos',
        materialCampo: 'capacidad',
      },
    },
    {
      codigo: 'cableado',
      nombre: 'Cable y conectores (opcional)',
      tipo: 'INSUMO_PASO',
      requerido: false,
      compatibilidadMaterial: {
        familiasMateriaPrima: ['ELECTRONICA_CARTELERIA'],
        subfamiliasMateriaPrima: ['CABLEADO_CONECTICA'],
      },
      // ml estimados: perímetro × 1,4 + 12 cm por módulo (los deriva el sembrado).
      magnitudDerivada: 'cableMl',
    },
  ],
  permiteSlotsAdicionales: true,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['modulos_led', 'watts_led'],
  derivador: {
    codigo: 'sembrado_led',
    magnitudPrincipal: 'modulos',
    unidadPrincipal: 'módulos',
    outputs: {
      modulos_led: 'modulos',
      watts_led: 'watts',
    },
    materialSlot: 'modulos_led',
    mensajeSinDatos:
      'no pudo derivar los módulos LED: el módulo del slot no declara cobertura (m²) ni paso (mm) en sus atributos, o el slot quedó sin material.',
    sugerenciaSinDatos:
      'Completá coberturaM2 (sembrado por área) o pasoMm (por recorrido) en la variante del módulo LED de la biblioteca.',
    codigoSinDatos: 'iluminacion_led_sin_modulo',
  },
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'modoSembrado',
      etiqueta: 'Modo de sembrado',
      tipo: 'enum',
      valoresPermitidos: ['area', 'recorrido'],
      default: 'area',
      requerido: true,
      descripcion:
        'Por área: grilla sobre la cara (backlight, light box). Por recorrido: siguiendo el trazo (corpóreas).',
    },
    {
      campo: 'densidad',
      etiqueta: 'Densidad (multiplicador)',
      tipo: 'number',
      default: 1,
      requerido: false,
      descripcion:
        '1 = densidad recomendada del módulo. 1,5 = 50% más módulos (más brillo).',
      expuestoAlComercial: true,
    },
    // Criterios de TALLER que antes eran constantes del código (regla 1 del
    // ejercicio, carteleria-pasos-revision.md §8). Defaults = valor histórico.
    {
      campo: 'margenFuentePct',
      etiqueta: 'Margen de la fuente (%)',
      tipo: 'number',
      default: 30,
      requerido: false,
      descripcion:
        'Colchón sobre los watts sembrados para elegir la fuente: 16 módulos de 0,72 W = 11,5 W → con 30% la fuente debe cumplir 15 W.',
    },
    {
      campo: 'factorCablePerimetro',
      etiqueta: 'Cable: factor sobre el perímetro',
      tipo: 'number',
      default: 1.4,
      requerido: false,
      descripcion:
        'Metros de cable = perímetro × este factor + los cm por módulo.',
    },
    {
      campo: 'cablePorModuloCm',
      etiqueta: 'Cable por módulo (cm)',
      tipo: 'number',
      default: 12,
      requerido: false,
      descripcion: 'Chicote de conexión de cada módulo.',
    },
  ],
  productosTipicos: [
    'Cartel backlight',
    'Letra corpórea iluminada',
    'Light box',
  ],
};

const montaje_sobre_sustrato: DefinicionFamilia = {
  codigo: 'montaje_sobre_sustrato',
  // [Tanda C] Antes: defaults cableados por nombre en el editor.
  mecanismoCantidadDefault: 'CALCULADO_POR_PASO',
  ritmoDefault: {
    modoCalculo: 'batch_time',
    fuenteCantidad: 'cantidad_montaje',
  },
  nombre: 'Montado sobre material',
  categoria: 'estructural_montaje',
  // [Etapa F] Antes: caso 5 del dispatcher, ruteado por familiaCodigo. La
  // superficie real la decide el material de montaje elegido en runtime.
  nestingConfig: {
    superficie: 'segun_material',
    estrategia: 'montaje',
    guardSinLayout: 'montaje',
  },
  descripcion:
    'Monta una salida impresa o cortada sobre otro sustrato, calculando el consumo del material de montaje con nesting propio.',
  // M-0 puro (decisión 2026-08-11): montar/colocar es manual — la mesa no
  // es una máquina con tarifa propia. T-3 se va con la máquina (cero uso).
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['CALCULADO_POR_PASO'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL', 'CONDICIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'sustrato_montaje',
      nombre: 'Material de montaje',
      tipo: 'SUSTRATO',
      requerido: true,
      compatibilidadMaterial: MP.sustratoMontaje,
    },
    {
      codigo: 'adhesivo_montaje',
      nombre: 'Adhesivo de montaje',
      tipo: 'INSUMO_PASO',
      requerido: false,
      compatibilidadMaterial: MP.adhesivo,
    },
  ],
  permiteSlotsAdicionales: true,
  plantillasCompatibles: [],
  // Montar 200 piezas lleva 200 operaciones aunque salgan de 3 placas: el
  // tiempo cuenta piezas a pegar, no el sustrato que consumió el nesting.
  // [Etapa A: era un if en motor cuyo cuerpo ya existía genérico]
  magnitudTiempoDefault: 'cantidad_montaje',
  // Se puede montar la pieza terminada o el pliego que salió de imprenta —
  // lo elige el modelador con `fuentePiezasMontaje`. A diferencia del
  // laminado, acá la cantidad tolera que el pliego venga del cálculo de
  // pre-prensa y no de una impresión real.
  // [Etapa A: la tabla de claves estaba en buildJobContextMontaje]
  fuentesPiezasNesting: {
    pliegos_impresos: {
      cantidadDesde: ['pliegos_impresos', 'pliegos_calculados'],
      anchoDesde: 'pliego_impresion_ancho_mm',
      altoDesde: 'pliego_impresion_alto_mm',
    },
  },
  fuentePiezasDefault: 'piezas_jobcontext',
  inputsRequeridos: [],
  outputsCanonicos: ['piezas_montadas', 'm2_calculados', 'aprovechamiento_pct'],
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'fuentePiezasMontaje',
      etiqueta: 'Piezas a montar',
      tipo: 'enum',
      valoresPermitidos: [
        'piezas_jobcontext',
        'piezas_visibles',
        'pliegos_impresos',
      ],
      default: 'piezas_jobcontext',
      descripcion:
        'Define si el montaje usa las piezas del producto (con las demasías que hayan agregado pasos previos), la medida VISIBLE terminada (chapa trasera cortada al marco), o los pliegos ya impresos por un paso anterior.',
    },
  ],
  productosTipicos: [
    'Vinilo impreso montado en PVC',
    'Papel adhesivo montado en imán',
    'Cartelería en foamboard',
  ],
};

// ============================================================================
// 3.7 Operaciones manuales
// ============================================================================

const embalaje: DefinicionFamilia = {
  codigo: 'embalaje',
  // [Tanda C] Antes: defaults cableados por nombre en el editor.
  ritmoDefault: { modoCalculo: 'batch_time' },
  nombre: 'Embalaje',
  categoria: 'operaciones_manuales',
  descripcion: 'Embalado en cajas o bolsas para entrega.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['CONVERSION', 'DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OBLIGATORIO'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'caja',
      nombre: 'Caja / bolsa',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.packaging,
    },
    {
      codigo: 'cinta',
      nombre: 'Cinta',
      tipo: 'INSUMO_PASO',
      requerido: false,
      compatibilidadMaterial: MP.cinta,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['cajas_embaladas'],
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'piezasPorCaja',
      etiqueta: 'Piezas por caja',
      tipo: 'number',
      default: 100,
      requerido: false,
      descripcion:
        'Cuántas piezas entran por caja. Para cálculo de cantidad de cajas via CONVERSION.',
    },
  ],
  productosTipicos: ['Tarjetas (cajas de 100)', 'Cualquier producto'],
};

const trabajo_manual: DefinicionFamilia = {
  codigo: 'trabajo_manual',
  // [F1 efectos] El paso puede exigirle demasía al trabajo.
  efectosSoportados: ['demasiaMedida'],
  nombre: 'Trabajo manual',
  categoria: 'operaciones_manuales',
  descripcion:
    'Tarea manual genérica configurable por producto/ruta. Usar nombre visible para identificar la operación concreta.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'HEREDAR_DEL_OUTPUT_CANONICO',
    'CONVERSION',
  ],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL', 'CONDICIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'insumo_manual',
      nombre: 'Insumo manual (opcional)',
      tipo: 'INSUMO_PASO',
      requerido: false,
      compatibilidadMaterial: MP.insumoManual,
    },
  ],
  permiteSlotsAdicionales: true,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['trabajos_manuales_realizados'],
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'tipoTrabajo',
      etiqueta: 'Tipo de trabajo',
      tipo: 'string',
      requerido: false,
      descripcion:
        'Texto opcional para documentar la operación. El nombre visible del paso es el label principal.',
    },
  ],
  productosTipicos: [
    'Pegado de cinta bifaz',
    'Plegado manual',
    'Colocación de velcro',
    'Control o retoque manual',
  ],
};

const modificacion_post: DefinicionFamilia = {
  codigo: 'modificacion_post',
  // [Etapa F3] Antes: switch defaultOutputParaHeredar en motor.service.
  outputHeredadoDefault: 'piezas_cortadas',
  nombre: 'Modificación post-producción',
  categoria: 'operaciones_manuales',
  descripcion:
    'Modificación física que se ejecuta DESPUÉS de los pasos de producción (sin alterar valores previos). Ej: perforaciones, redondeo de puntas, numeración.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-1', 'T-2'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'HEREDAR_DEL_OUTPUT_CANONICO',
  ],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: ['cantidadModificacionesPorPieza'],
  slotsRequeridos: [],
  permiteSlotsAdicionales: true,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_modificadas'],
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'subTipo',
      etiqueta: 'Sub-tipo de modificación',
      tipo: 'enum',
      valoresPermitidos: [
        'perforacion',
        'redondeo_puntas',
        'numeracion',
        'aplicacion_pegamento',
        'aplicacion_velcro',
      ],
      requerido: true,
    },
  ],
  productosTipicos: ['Tarjetas con redondeo', 'Talonarios numerados'],
};

const colocacion_ojales: DefinicionFamilia = {
  codigo: 'colocacion_ojales',
  // [Tanda B] Antes: FAMILIAS_CON_PARAMS_EDITABLES en el frontend.
  editorParamsGenerico: true,
  nombre: 'Colocación de ojales',
  categoria: 'operaciones_manuales',
  descripcion:
    'Coloca ojales sobre el perímetro de la pieza. La cantidad se DERIVA de la medida visible y de cada cuántos mm van los ojales — no la carga el comercial. Suele ir después de un refuerzo perimetral.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-1', 'T-2'],
  // CALCULADO_POR_PASO: el paso deriva la cantidad del perímetro visible.
  mecanismosCantidadSoportados: [
    'CALCULADO_POR_PASO',
    'DIRECT_FROM_JOBCONTEXT',
  ],
  modosActivacionSoportados: ['OPCIONAL', 'OBLIGATORIO', 'CONDICIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'ojal',
      nombre: 'Ojal / ojalillo',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: {
        familiasMateriaPrima: ['HERRAJE_ACCESORIO'],
        subfamiliasMateriaPrima: ['OJAL_OJALILLO_REMACHE'],
      },
    },
  ],
  permiteSlotsAdicionales: true,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['ojales_colocados'],
  derivador: {
    codigo: 'layout_ojales',
    magnitudPrincipal: 'ojales',
    unidadPrincipal: 'ojales',
    outputs: {
      ojales_colocados: 'ojales',
    },
    mensajeSinDatos:
      'no declara separación entre ojales ni lados, así que no puede calcular cuántos ojales entran.',
    sugerenciaSinDatos:
      'Configurar en el paso la separación máxima entre ojales (mm) y los lados donde van.',
    codigoSinDatos: 'colocacion_ojales_mal_configurada',
  },
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'separacionMaxMm',
      etiqueta: 'Separación máxima entre ojales (mm)',
      tipo: 'number',
      requerido: true,
      descripcion:
        'Es un MÁXIMO, no un valor exacto: los ojales se reparten parejos por cada lado sin superar esta distancia.',
    },
    {
      campo: 'lados',
      etiqueta: 'Lados con ojales',
      tipo: 'multi-enum',
      valoresPermitidos: ['superior', 'inferior', 'izquierdo', 'derecho'],
      requerido: true,
    },
    {
      campo: 'distanciaBordeMm',
      etiqueta: 'Distancia al borde sin refuerzo (mm)',
      tipo: 'number',
      default: 10,
      requerido: false,
      descripcion:
        'Sólo para lados SIN refuerzo. Donde hay refuerzo no hace falta configurar nada: el refuerzo doblado deja una banda de su mismo ancho y el ojal se centra en ella (refuerzo de 20 mm → ojal a 10 mm del borde).',
    },
    {
      campo: 'esquinasSiempre',
      etiqueta: 'Ojal en cada esquina',
      tipo: 'boolean',
      default: true,
      requerido: false,
      descripcion:
        'Práctica de taller: la esquina lleva ojal sí o sí. Cuando dos lados adyacentes llevan ojales, la esquina se cuenta UNA sola vez.',
    },
  ],
  productosTipicos: ['Lona con ojales', 'Banner para colgar'],
};

const colocacion_raspadita: DefinicionFamilia = {
  codigo: 'colocacion_raspadita',
  nombre: 'Colocación de raspadita',
  categoria: 'operaciones_manuales',
  descripcion:
    'Colocación manual de una o más pegatinas raspables sobre cada pieza impresa. El consumo normal es una raspadita por unidad pedida; el factor del material permite configurar más de una por pieza.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OPCIONAL', 'OBLIGATORIO', 'CONDICIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'raspadita',
      nombre: 'Pegatina raspadita',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: {
        familiasMateriaPrima: ['TERMINACION_EDITORIAL'],
        subfamiliasMateriaPrima: ['PEGATINA_RASPADITA'],
        templateIds: ['pegatina_raspadita_v1'],
      },
      formulaForzada: 'por_pieza',
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['raspaditas_colocadas'],
  validaciones: [
    {
      codigo: 'requires_cantidad',
      tipo: 'REQUIRES_INPUT',
      campo: 'cantidad',
      mensaje: 'Falta declarar la cantidad de piezas que llevan raspadita',
    },
  ],
  paramsPasoSchema: [],
  productosTipicos: [
    'Tarjetas personales con raspadita',
    'Cupones promocionales',
    'Tickets de premios',
  ],
};

// ============================================================================
// 3.8 Logística / instalación in situ (1)
// ============================================================================

const instalacion_in_situ: DefinicionFamilia = {
  codigo: 'instalacion_in_situ',
  // [Tanda C] Antes: defaults cableados por nombre en el editor.
  ritmoDefault: { unidad: 'm2_h', fuenteCantidad: 'area_piezas_m2' },
  nombre: 'Instalación en sitio',
  categoria: 'logistica_instalacion',
  descripcion:
    'Colocación del producto en el lugar del cliente. Cargo directo de viático por zona aparte.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['m2_instalados'],
  outputsCanonicos: ['m2_instalados_realizados'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: ['Vinilo adhesivo', 'Cartelería'],
};

// ============================================================================
// 3.9 Servicios profesionales (1)
// ============================================================================

const diseno_grafico: DefinicionFamilia = {
  codigo: 'diseno_grafico',
  nombre: 'Diseño gráfico',
  categoria: 'servicios_profesionales',
  descripcion:
    'Servicio de diseño cuando el cliente no trae arte listo. Tarifa fija o por horas.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-1', 'T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['diseno_aprobado'],
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'horasEstimadas',
      etiqueta: 'Horas estimadas (solo si T-2)',
      tipo: 'number',
      requerido: false,
      descripcion:
        'Horas que el comercial estima al cotizar. Solo aplica si modoTiempo = T-2.',
    },
  ],
  productosTipicos: ['Cualquier producto cuando el cliente no trae diseño'],
};

// ============================================================================
// EXPORTAR el catálogo completo
// ============================================================================

export const FAMILIAS: Record<FamiliaCodigo, DefinicionFamilia> = {
  pre_prensa,
  impresion_por_hoja,
  impresion_por_area,
  impresion_por_pieza,
  impresion_3d,
  aplicacion_transfer,
  aplicacion_transfer_textil,
  grabado_laser,
  corte_guillotina,
  plotter_corte,
  corte_laser,
  troquelado_digital,
  cnc,
  plegado,
  corte_manual,
  corte_hilo_caliente,
  laminado,
  plastificado_pouch,
  pintura_superficial,
  abrochado_caballete,
  encuadernado_anillado,
  engomado_emblocado,
  montaje_sobre_sustrato,
  ensamble_estructural,
  estructura_bastidor,
  iluminacion_led,
  embalaje,
  trabajo_manual,
  modificacion_post,
  colocacion_ojales,
  colocacion_raspadita,
  instalacion_in_situ,
  diseno_grafico,
};

// ============================================================================
// Helpers
// ============================================================================

/** Devuelve la definición de una familia por su código. Lanza error si no existe. */
export function getFamilia(codigo: FamiliaCodigo): DefinicionFamilia {
  const familia = FAMILIAS[codigo];
  if (!familia) {
    throw new Error(`Familia desconocida: ${codigo}`);
  }
  return familia;
}

/** Lista todos los códigos de familia. */
export function listarFamilias(): FamiliaCodigo[] {
  return Object.keys(FAMILIAS) as FamiliaCodigo[];
}

/** Lista familias por categoría. */
export function listarFamiliasPorCategoria(
  categoria: string,
): DefinicionFamilia[] {
  return Object.values(FAMILIAS).filter((f) => f.categoria === categoria);
}

/**
 * Modo de registro del trabajo en el tablero (registro-tiempos-produccion
 * D1): override explícito de la familia o default por categoría — las de
 * produccion_impresion se completan de un click (el cronómetro por trabajo
 * mediría cola/tandas, no producción); el resto usa cronómetro con tramos.
 * Acepta string crudo porque el paso materializado guarda el código plano.
 */
export function modoRegistroDeFamilia(codigo: string): ModoRegistroPaso {
  const familia = resolverFamilia(codigo);
  if (!familia) return 'cronometro';
  return (
    familia.modoRegistro ??
    (familia.categoria === 'produccion_impresion'
      ? 'solo_completar'
      : 'cronometro')
  );
}

/** Cantidad total de familias en el catálogo. */
export const FAMILIAS_TOTAL = Object.keys(FAMILIAS).length;

// ============================================================================
// Resolver único (Etapa C — pasos componibles)
// ============================================================================
//
// Además del catálogo fijo de arriba existen las familias que crea cada
// TENANT (tabla PasoTenant). Este registro en memoria las hace resolubles
// de forma SÍNCRONA, que es como el motor y todos los consumidores leen
// familias — async-ificar ~10 call sites del motor sería mucho más invasivo.
//
// Quién lo llena: PasosTenantService — carga todo al bootear el módulo y
// escribe-through en cada alta/edición/borrado. Trade-off asumido y
// documentado en el plan: con VARIAS instancias del API una edición tarda
// hasta el próximo boot en verse en las otras; hoy corre una sola.
//
// El registro guarda TAMBIÉN las inhabilitadas: el resolver resuelve siempre
// (una OT histórica tiene que poder mostrar su paso); `activo` sólo filtra
// selectores y wizard (decisión §8.6 del diseño).

const REGISTRO_TENANT = new Map<string, DefinicionFamiliaResuelta>();

/** Reemplaza el registro entero (boot del módulo). */
export function cargarRegistroPasosTenant(
  defs: DefinicionFamiliaResuelta[],
): void {
  REGISTRO_TENANT.clear();
  for (const def of defs) REGISTRO_TENANT.set(def.codigo, def);
}

/** Alta o edición: escribe-through desde el service. */
export function registrarPasoTenant(def: DefinicionFamiliaResuelta): void {
  REGISTRO_TENANT.set(def.codigo, def);
}

/** Borrado físico (sólo instancias vírgenes): sale del registro. */
export function quitarPasoTenantDelRegistro(id: string): void {
  REGISTRO_TENANT.delete(id);
}

/**
 * EL punto de resolución: catálogo fijo primero, registro tenant después.
 * Todo consumidor de familias pasa por acá — no leer FAMILIAS[...] directo,
 * que una familia tenant se saltearía en silencio.
 */
export function resolverFamilia(
  codigo: string,
): DefinicionFamiliaResuelta | undefined {
  return (
    (FAMILIAS as Record<string, DefinicionFamilia | undefined>)[codigo] ??
    REGISTRO_TENANT.get(codigo)
  );
}

/**
 * ¿La familia acepta este tipo de perfil operativo? Lee
 * `tiposPerfilCompatibles` de la declaración; una familia que no lo declara
 * (o un código desconocido) acepta cualquiera — mismo fallthrough que tenían
 * los if duplicados en motor.service y config-pasos.service. [Etapa A]
 * Acepta string crudo porque los callers manejan códigos planos.
 */
export function perfilCompatibleConFamilia(
  codigo: string,
  tipoPerfil?: string | null,
): boolean {
  const familia = resolverFamilia(codigo);
  const tipos = familia?.tiposPerfilCompatibles;
  if (!tipos || tipos.length === 0) return true;
  return tipoPerfil != null && tipos.includes(tipoPerfil);
}

/**
 * Fórmula efectiva de consumo de un slot: la que la declaración FUERZA si
 * existe (`formulaForzada`), si no la configurada, si no el default.
 * [Etapa A: era `normalizarFormulaSlotMaterial` con un if por familia]
 */
export function formulaEfectivaSlot(
  codigo: string,
  slotCodigo: string,
  formula?: string | null,
): string {
  const familia = resolverFamilia(codigo);
  const slot = familia?.slotsRequeridos.find((s) => s.codigo === slotCodigo);
  if (slot?.formulaForzada) return slot.formulaForzada;
  return formula ?? 'por_unidad_productiva';
}

/**
 * ¿El costeo del material de este slot ignora el multiplicador de caras?
 * Lee `ignoraMultiplicadorCaras` del slot declarado. [Etapa A]
 */
export function slotIgnoraMultiplicadorCaras(
  codigo: string,
  slotCodigo: string,
): boolean {
  const familia = resolverFamilia(codigo);
  return (
    familia?.slotsRequeridos.find((s) => s.codigo === slotCodigo)
      ?.ignoraMultiplicadorCaras === true
  );
}

/**
 * ¿La familia factura consumibles de máquina? Lee `sinConsumiblesMaquina`.
 * [Etapa A: era el if de plotter_corte en motor.service]
 */
export function familiaSinConsumiblesMaquina(codigo: string): boolean {
  const familia = resolverFamilia(codigo);
  return familia?.sinConsumiblesMaquina === true;
}

/**
 * De dónde sale el margen físico que el sustrato no puede usar. Una familia
 * que no lo declara lee `margenesNoImprimiblesMm` de la máquina — el mismo
 * fallthrough que tenía el if. [Etapa A]
 */
export function origenMargenesNestingDeFamilia(
  codigo: string,
): NonNullable<DefinicionFamilia['origenMargenesNesting']> {
  return (
    resolverFamilia(codigo)?.origenMargenesNesting ?? {
      fuente: 'maquina',
      campo: 'margenesNoImprimiblesMm',
    }
  );
}

/** Campo de la máquina que aporta la separación entre piezas, si la familia
 *  declara uno. [Etapa A] */
export function campoSeparacionMaquinaDeFamilia(codigo: string): string | null {
  return resolverFamilia(codigo)?.campoSeparacionMaquina ?? null;
}

/** Estrategia de nesting declarada por la familia; null si no declara.
 *  [Etapa F2] */
export function estrategiaNestingDeFamilia(
  codigo: string,
): NonNullable<DefinicionFamilia['nestingConfig']>['estrategia'] | null {
  return resolverFamilia(codigo)?.nestingConfig?.estrategia ?? null;
}

/** Guard sin-layout declarado por la familia; null → fallback silencioso.
 *  [Etapa F2] */
export function guardSinLayoutDeFamilia(
  codigo: string,
): NonNullable<DefinicionFamilia['nestingConfig']>['guardSinLayout'] | null {
  return resolverFamilia(codigo)?.nestingConfig?.guardSinLayout ?? null;
}

/** ¿La familia es de impresión? (esImpresion declarado). [Tanda D] */
export function esImpresionDeFamilia(codigo: string): boolean {
  return resolverFamilia(codigo)?.esImpresion === true;
}

/** ¿La familia PUBLICA este output canónico? Sirve para encontrar "el paso
 *  que hace X" por capacidad declarada, no por nombre (el anillado es el que
 *  publica libros_anillados). [Tanda D] */
export function familiaPublicaOutput(
  codigo: string | null | undefined,
  output: string,
): boolean {
  if (!codigo) return false;
  return resolverFamilia(codigo)?.outputsCanonicos.includes(output) ?? false;
}

/** ¿Un paso de esta familia puede declarar este efecto? Gobierna la UI: el
 *  motor aplica lo que el paso tenga configurado. [F1 efectos] */
export function familiaSoportaEfecto(
  codigo: string,
  efecto: 'demasiaMedida',
): boolean {
  return resolverFamilia(codigo)?.efectosSoportados?.includes(efecto) ?? false;
}

/** Primitivas declaradas por la familia; null si no declara. [P1] */
export function primitivasDeFamilia(
  codigo: string,
): DefinicionFamilia['primitivas'] | null {
  return resolverFamilia(codigo)?.primitivas ?? null;
}

/** Fallback de cantidad cuando el acomodado no dio layout (y el guard no
 *  cortó); null → cantidad del pedido tal cual. [Tanda A] */
export function fallbackSinLayoutDeFamilia(
  codigo: string,
): NonNullable<DefinicionFamilia['nestingConfig']>['fallbackSinLayout'] | null {
  return resolverFamilia(codigo)?.nestingConfig?.fallbackSinLayout ?? null;
}

/**
 * Cola de consolidación donde entra un ítem cuyo paso FRONTERA (primer paso
 * no hecho) es de esta familia: impresión sobre material continuo
 * (`segun_material`) → simulador de gran formato; impresión sobre pliego →
 * simulador láser. Derivado de `esImpresion` + superficie declarada.
 * [Tanda A: los simuladores preguntaban por familiaCodigo]
 */
export function colaConsolidacionDeFamilia(
  codigo: string,
): 'gran_formato' | 'laser' | null {
  const f = resolverFamilia(codigo);
  if (!f?.esImpresion || !f.nestingConfig) return null;
  if (f.nestingConfig.superficie === 'segun_material') return 'gran_formato';
  if (
    f.nestingConfig.superficie === 'pliego' ||
    f.nestingConfig.superficie === 'pliegos_multiples'
  ) {
    return 'laser';
  }
  return null;
}

/** Márgenes de nesting por defecto de la familia; cero si no declara. [Etapa A] */
export function margenesNestingDefaultDeFamilia(
  codigo: string,
): NonNullable<DefinicionFamilia['margenesNestingDefault']> {
  return (
    resolverFamilia(codigo)?.margenesNestingDefault ?? {
      leftMm: 0,
      rightMm: 0,
      topMm: 0,
      bottomMm: 0,
    }
  );
}

/** Separación entre piezas por defecto de la familia, en mm. [Etapa A] */
export function separacionNestingDefaultDeFamilia(codigo: string): number {
  return resolverFamilia(codigo)?.separacionNestingDefaultMm ?? 0;
}

/**
 * ¿La separación configurada es aire literal entre piezas (pouch) en vez de
 * demasía por pieza? Ver `semanticaSeparacion` en types.ts. [Etapa A]
 */
export function separacionEsLiteral(codigo: string): boolean {
  return resolverFamilia(codigo)?.semanticaSeparacion === 'literal';
}

/** Magnitud que alimenta la productividad cuando el modelador no eligió una.
 *  [Etapa A] */
export function magnitudTiempoDefaultDeFamilia(codigo: string): string | null {
  return resolverFamilia(codigo)?.magnitudTiempoDefault ?? null;
}

/**
 * De dónde saca las piezas el nesting de este paso.
 *
 * Devuelve `null` cuando el paso acomoda las piezas del propio trabajo —
 * sea porque la familia no declara fuentes heredadas, porque el modelador
 * eligió `piezas_jobcontext`, o porque eligió una fuente que la familia no
 * declara (mismo fallthrough que tenían los ifs). [Etapa A]
 */
export function fuentePiezasNestingDeFamilia(
  codigo: string,
  seleccion?: string | null,
): FuentePiezasNesting | null {
  const familia = resolverFamilia(codigo);
  const fuentes = familia?.fuentesPiezasNesting;
  if (!fuentes) return null;
  const clave = seleccion || familia?.fuentePiezasDefault;
  if (!clave) return null;
  return fuentes[clave] ?? null;
}

/**
 * Campos del schema que el COMERCIAL puede pisar por runtime aunque el
 * modelador no los haya abierto (`expuestoAlComercial` en la declaración).
 * Ver `ParamsPasoDeclarado.expuestoAlComercial` en types.ts.
 * [Etapa 3 derivadores: era CAMPOS_SIEMPRE_EDITABLES_POR_FAMILIA en motor]
 */
export function camposExpuestosAlComercial(familiaCodigo: string): string[] {
  return (resolverFamilia(familiaCodigo)?.paramsPasoSchema ?? [])
    .filter((p) => p.expuestoAlComercial === true)
    .map((p) => p.campo);
}
