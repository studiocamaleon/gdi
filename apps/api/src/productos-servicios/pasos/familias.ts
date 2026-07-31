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
  sustratoPieza: {
    familiasMateriaPrima: ['SUSTRATO'],
    subfamiliasMateriaPrima: [
      'SUSTRATO_RIGIDO',
      'OBJETO_PROMOCIONAL_BASE',
      'TEXTIL_INDUMENTARIA',
    ],
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
    familiasMateriaPrima: ['SUSTRATO', 'MAGNETICO_FIJACION', 'POP_EXHIBIDOR'],
    subfamiliasMateriaPrima: [
      'SUSTRATO_RIGIDO',
      'SUSTRATO_ROLLO_FLEXIBLE',
      'SUSTRATO_HOJA',
      'IMAN_CERAMICO_FLEXIBLE',
      'SEMIELABORADO_POP',
      'ACCESORIO_MONTAJE_POP',
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
      'AUXILIAR_PROCESO',
    ],
  },
} satisfies Record<string, CompatibilidadMaterialSlot>;

// ============================================================================
// 3.1 Pre-prensa (2)
// ============================================================================

const pre_prensa: DefinicionFamilia = {
  codigo: 'pre_prensa',
  nombre: 'Pre-prensa / revisión y armado',
  descripcion:
    'Revisión de archivos, armado y preparación del material para imprimir. La imposición la calcula el paso que imprime.',
  categoria: 'pre_prensa',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-1'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'CALCULADO_POR_PASO',
  ],
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
  paramsPasoSchema: [],
  productosTipicos: [
    'Tarjetas de Visita',
    'Vinilo adhesivo',
    'Talonarios',
    'Rígidos impresos',
  ],
};

const proof: DefinicionFamilia = {
  codigo: 'proof',
  nombre: 'Proof / pruebas de color',
  categoria: 'pre_prensa',
  descripcion:
    'Impresión de prueba para validar color con el cliente antes de tirada.',
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-1'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'HEREDAR_DEL_OUTPUT_CANONICO',
  ],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'sustrato_proof',
      nombre: 'Sustrato del proof',
      tipo: 'SUSTRATO',
      requerido: true,
      compatibilidadMaterial: MP.sustratoHoja,
    },
  ],
  permiteSlotsAdicionales: false,
  // v3.0: solo IMPRESORA_LASER (INYECCION_TINTA descartada según doc §4).
  plantillasCompatibles: ['IMPRESORA_LASER'],
  inputsRequeridos: [],
  outputsCanonicos: ['proof_aprobado'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: ['Productos premium con muestra previa'],
};

// ============================================================================
// 3.2 Producción / impresión (5)
// ============================================================================

const impresion_por_hoja: DefinicionFamilia = {
  codigo: 'impresion_por_hoja',
  nombre: 'Impresión por hoja',
  categoria: 'produccion_impresion',
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
    'talonario_pilas',
    'pliego_impresion_ancho_mm',
    'pliego_impresion_alto_mm',
    'pliego_impresion_area_m2',
    'pliego_impresion_mp_variante_id',
    'tiempo_real_impresion',
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
      etiqueta: 'Modo de talonarios incompletos',
      tipo: 'enum',
      valoresPermitidos: ['aprovechar_pliego', 'pose_completa'],
      default: 'aprovechar_pliego',
      descripcion:
        'Solo aplica para talonarios. Decide qué hacer cuando la cantidad pedida no completa un grupo entero de poses.',
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
  nestingConfig: { superficie: 'segun_material' },
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

const aplicacion_transfer: DefinicionFamilia = {
  codigo: 'aplicacion_transfer',
  nombre: 'Aplicación de transfer (DTF, DTG)',
  categoria: 'produccion_impresion',
  descripcion:
    'Aplica film/transfer impreso al sustrato. Con plancha/máquina (DTG, DTF textil) o manual (DTF UV sobre objetos: tazas, botellas).',
  // Soporta ambas: manual (M-0, ej. DTF UV a mano) y con máquina (M-1, ej. DTG
  // con plancha). El modelador elige por paso.
  relacionMaquinaSoportada: ['M-0', 'M-1'],
  // T-2 = productividad propia (manual, ej. X piezas/h a mano); T-3 = del perfil
  // de la máquina. El modelador elige según sea manual o con máquina.
  modosTiempoSoportados: ['T-2', 'T-3'],
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
      nombre: 'Sustrato / objeto base',
      tipo: 'SUSTRATO',
      requerido: true,
      // Acepta prenda (remera), objeto (taza/botella) o rígido. Su costo entra
      // por unidad (formula por_pieza).
      compatibilidadMaterial: MP.sustratoPieza,
    },
    {
      codigo: 'film_transfer',
      nombre: 'Film transfer impreso (comprado listo)',
      tipo: 'INSUMO_PASO',
      // OPCIONAL: solo se completa si se compra el transfer ya impreso. Si el
      // film se imprime en un paso previo (impresion_por_area con tecnologia
      // DTF_UV/DTF_TEXTIL), su costo ya está ahí — dejar este slot vacío para no
      // duplicarlo.
      requerido: false,
      compatibilidadMaterial: MP.filmTransfer,
    },
  ],
  permiteSlotsAdicionales: false,
  // v3.0: la impresión del FILM DTF la hace IMPRESORA_GRAN_FORMATO_POR_AREA
  // con tecnologia=DTF_UV o DTF_TEXTIL (paso anterior). Esta familia es la
  // APLICACIÓN del transfer al sustrato/objeto — con plancha (M-1) o manual
  // (M-0, ej. DTF UV sobre tazas). El film ya viene costeado del paso previo,
  // por eso el slot de film es opcional.
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_aplicadas'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: ['Remeras estampadas', 'Camperas con logo'],
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
// 3.3 Corte y formado (8)
// ============================================================================

const corte_guillotina: DefinicionFamilia = {
  codigo: 'corte_guillotina',
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
      mensaje: 'Guillotina necesita pliegos calculados por pre-prensa',
    },
    {
      // El run sale de los cortes, no de la productividad: sin cortes el
      // paso costaba 0 minutos en silencio. Pasa cuando el trabajo lleva
      // más de una medida y el acomodo deja de ser una grilla.
      codigo: 'existe_cortes',
      tipo: 'EXISTS_OUTPUT',
      outputCanonico: 'cortes_calculados',
      mensaje:
        'Guillotina no puede calcular el tiempo: el acomodo de pre-prensa no ' +
        'dejó una grilla de columnas por filas, así que no hay cortes que ' +
        'contar. Suele pasar cuando el trabajo tiene piezas de medidas ' +
        'distintas en el mismo pliego.',
    },
  ],
  paramsPasoSchema: [],
  productosTipicos: ['Tarjetas de Visita', 'Talonarios', 'Folletería'],
};

const plotter_corte: DefinicionFamilia = {
  codigo: 'plotter_corte',
  nombre: 'Plotter de corte',
  categoria: 'corte_y_formado',
  descripcion:
    'Corte de vinilo o papel adhesivo con plotter (Skycut, Roland). Soporta medio corte / corte profundo / corte completo.',
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: ['CALCULADO_POR_PASO'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
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
  modosTiempoSoportados: ['T-3', 'T-4'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
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
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
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
  nombre: 'Plegado manual',
  categoria: 'corte_y_formado',
  descripcion: 'Plegado de pliegos para folletos, dípticos, trípticos.',
  visibleEnSelector: false,
  relacionMaquinaSoportada: ['M-0', 'M-1'],
  modosTiempoSoportados: ['T-2', 'T-3'],
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

const perforado: DefinicionFamilia = {
  codigo: 'perforado',
  nombre: 'Perforado / puntillado (industrial)',
  categoria: 'corte_y_formado',
  descripcion:
    'Perforación con máquina industrial de perforado (NO confundir con modificacion_post manual).',
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: [
    'HEREDAR_DEL_OUTPUT_CANONICO',
    'DIRECT_FROM_JOBCONTEXT',
  ],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: ['perforacionesPorPieza'],
  slotsRequeridos: [],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_perforadas'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: ['Talonarios numerados (puntillado para arrancar)'],
};

const corte_manual: DefinicionFamilia = {
  codigo: 'corte_manual',
  nombre: 'Corte manual (trincheta / sierra)',
  categoria: 'corte_y_formado',
  descripcion:
    'Corte manual con trincheta o sierra para señalética PVC, MDF fino. Sin máquina industrial.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'HEREDAR_DEL_OUTPUT_CANONICO',
  ],
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_cortadas'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: ['Señalética PVC chica', 'MDF fino'],
};

// ============================================================================
// 3.4 Terminaciones (5)
// ============================================================================

const laminado: DefinicionFamilia = {
  codigo: 'laminado',
  nombre: 'Laminado',
  categoria: 'terminaciones',
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
  productosTipicos: ['Credenciales plastificadas', 'Menús plastificados', 'Tarjetas rígidas pouch'],
};

const barniz: DefinicionFamilia = {
  codigo: 'barniz',
  nombre: 'Barniz',
  categoria: 'terminaciones',
  descripcion: 'Aplicación de barniz UV o al agua sobre superficie impresa.',
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: ['HEREDAR_DEL_OUTPUT_CANONICO'],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'barniz',
      nombre: 'Tipo de barniz',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.quimicoAcabado,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['piezas_barnizadas'],
  validaciones: [],
  paramsPasoSchema: [],
};

const acabado_decorativo: DefinicionFamilia = {
  codigo: 'acabado_decorativo',
  nombre: 'Acabado decorativo (hotstamping, dorado, gofrado)',
  categoria: 'terminaciones',
  descripcion: 'Aplicación de film metálico con prensa térmica.',
  relacionMaquinaSoportada: ['M-1'],
  modosTiempoSoportados: ['T-3'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'film_metalico',
      nombre: 'Film metálico (oro/plata/holograma)',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.filmMetalico,
    },
    {
      codigo: 'matriz',
      nombre: 'Matriz custom (opcional)',
      tipo: 'OTRO',
      requerido: false,
      compatibilidadMaterial: MP.matriz,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_decoradas'],
  validaciones: [],
  paramsPasoSchema: [],
};

const pintura_superficial: DefinicionFamilia = {
  codigo: 'pintura_superficial',
  nombre: 'Pintura superficial',
  categoria: 'terminaciones',
  descripcion: 'Pintura, laca o barniz protector sobre piezas rígidas.',
  relacionMaquinaSoportada: ['M-0', 'M-1'],
  modosTiempoSoportados: ['T-2', 'T-3'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
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

const lijado_canteado: DefinicionFamilia = {
  codigo: 'lijado_canteado',
  nombre: 'Lijado / canteado de bordes',
  categoria: 'terminaciones',
  descripcion:
    'Acabado manual de bordes en piezas rígidas (lija, multiherramienta).',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_lijadas'],
  validaciones: [],
  paramsPasoSchema: [],
  productosTipicos: ['Letras corpóreas MDF', 'Cuadros con bordes finos'],
};

// ============================================================================
// 3.5 Encuadernación / armado (4)
// ============================================================================

const encuadernado_engrapado: DefinicionFamilia = {
  codigo: 'encuadernado_engrapado',
  nombre: 'Engrapado (caballete / lateral)',
  categoria: 'encuadernacion_armado',
  descripcion:
    'Engrapado manual de pliegos con grapas. Caso único, sin sub-tipos.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'grapas',
      nombre: 'Grapas',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.grapas,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['libros_engrapados'],
  validaciones: [],
  paramsPasoSchema: [],
};

const encuadernado_anillado: DefinicionFamilia = {
  codigo: 'encuadernado_anillado',
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

const armado_cajas: DefinicionFamilia = {
  codigo: 'armado_cajas',
  nombre: 'Armado de cajas / packaging',
  categoria: 'encuadernacion_armado',
  descripcion: 'Armado manual de cajas de cartón (plegado + cinta).',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OBLIGATORIO'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'cinta',
      nombre: 'Cinta',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.cinta,
    },
    {
      codigo: 'plantilla_caja',
      nombre: 'Plantilla de caja',
      tipo: 'SUSTRATO',
      requerido: true,
      compatibilidadMaterial: MP.plantillaCaja,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['cajas_armadas'],
  validaciones: [],
  paramsPasoSchema: [],
};

// ============================================================================
// 3.6 Estructural / montaje físico (3)
// ============================================================================

const soldadura: DefinicionFamilia = {
  codigo: 'soldadura',
  nombre: 'Soldadura (herrería)',
  categoria: 'estructural_montaje',
  descripcion: 'Soldadura para estructuras metálicas (cartelería, marcos).',
  relacionMaquinaSoportada: ['M-0', 'M-1'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OBLIGATORIO'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'electrodos',
      nombre: 'Electrodos',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.soldadura,
    },
  ],
  permiteSlotsAdicionales: true,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['piezas_soldadas'],
  validaciones: [],
  paramsPasoSchema: [],
};

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

const montaje_sobre_sustrato: DefinicionFamilia = {
  codigo: 'montaje_sobre_sustrato',
  nombre: 'Montado sobre material',
  categoria: 'estructural_montaje',
  descripcion:
    'Monta una salida impresa o cortada sobre otro sustrato, calculando el consumo del material de montaje con nesting propio.',
  relacionMaquinaSoportada: ['M-0', 'M-1'],
  modosTiempoSoportados: ['T-2', 'T-3'],
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
  outputsCanonicos: [
    'piezas_montadas',
    'm2_calculados',
    'aprovechamiento_pct',
  ],
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'fuentePiezasMontaje',
      etiqueta: 'Piezas a montar',
      tipo: 'enum',
      valoresPermitidos: ['piezas_jobcontext', 'pliegos_impresos'],
      default: 'piezas_jobcontext',
      descripcion:
        'Define si el montaje usa las piezas del producto o los pliegos ya impresos por un paso anterior.',
    },
  ],
  productosTipicos: [
    'Vinilo impreso montado en PVC',
    'Papel adhesivo montado en imán',
    'Cartelería en foamboard',
  ],
};

const instalacion_electrica: DefinicionFamilia = {
  codigo: 'instalacion_electrica',
  nombre: 'Instalación eléctrica luminosos',
  categoria: 'estructural_montaje',
  descripcion: 'Cableado, transformadores, LEDs en carteles iluminados.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'cables',
      nombre: 'Cables',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.electricidad,
    },
    {
      codigo: 'transformador',
      nombre: 'Transformador',
      tipo: 'INSUMO_PASO',
      requerido: false,
      compatibilidadMaterial: MP.electricidad,
    },
    {
      codigo: 'leds',
      nombre: 'LEDs',
      tipo: 'INSUMO_PASO',
      requerido: false,
      compatibilidadMaterial: MP.electricidad,
    },
  ],
  permiteSlotsAdicionales: true,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['luminosos_instalados'],
  validaciones: [],
  paramsPasoSchema: [],
};

// ============================================================================
// 3.7 Operaciones manuales
// ============================================================================

const embalaje: DefinicionFamilia = {
  codigo: 'embalaje',
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

const conteo_manual: DefinicionFamilia = {
  codigo: 'conteo_manual',
  nombre: 'Conteo manual',
  categoria: 'operaciones_manuales',
  descripcion: 'Verificación de cantidad o compaginado.',
  visibleEnSelector: false,
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'HEREDAR_DEL_OUTPUT_CANONICO',
  ],
  modosActivacionSoportados: ['OPCIONAL', 'OBLIGATORIO', 'CONDICIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['piezas_contadas'],
  validaciones: [],
  paramsPasoSchema: [],
};

const atado_banding: DefinicionFamilia = {
  codigo: 'atado_banding',
  nombre: 'Atado / banding',
  categoria: 'operaciones_manuales',
  descripcion: 'Atado de paquetes con cinta o hilo.',
  visibleEnSelector: false,
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'cinta_banding',
      nombre: 'Cinta / hilo',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.banding,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['atados_completados'],
  validaciones: [],
  paramsPasoSchema: [],
};

const etiquetado_manual: DefinicionFamilia = {
  codigo: 'etiquetado_manual',
  nombre: 'Etiquetado manual',
  categoria: 'operaciones_manuales',
  descripcion: 'Aplicación manual de etiquetas adhesivas.',
  visibleEnSelector: false,
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [
    {
      codigo: 'etiqueta',
      nombre: 'Etiqueta adhesiva',
      tipo: 'INSUMO_PASO',
      requerido: true,
      compatibilidadMaterial: MP.etiqueta,
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: ['piezas_etiquetadas'],
  validaciones: [],
  paramsPasoSchema: [],
};

const control_calidad: DefinicionFamilia = {
  codigo: 'control_calidad',
  nombre: 'Control de calidad',
  categoria: 'operaciones_manuales',
  descripcion: 'Verificación visual o técnica de calidad final.',
  visibleEnSelector: false,
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
  outputsCanonicos: ['piezas_verificadas'],
  validaciones: [],
  paramsPasoSchema: [],
};

const trabajo_manual: DefinicionFamilia = {
  codigo: 'trabajo_manual',
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

const modificacion_pre: DefinicionFamilia = {
  codigo: 'modificacion_pre',
  nombre: 'Modificación pre-producción',
  categoria: 'operaciones_manuales',
  descripcion:
    'Demasía perimetral selectiva: agranda la medida de MATERIAL sobre los lados elegidos, antes de los pasos de producción. Bolsillos y refuerzos en lona. La unión (soldadura/pegado) se mide sobre la medida VISIBLE.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-1', 'T-2'],
  // CALCULADO_POR_PASO: el paso calcula sus propios metros lineales de unión a
  // partir de la medida visible + los lados elegidos.
  mecanismosCantidadSoportados: [
    'CALCULADO_POR_PASO',
    'DIRECT_FROM_JOBCONTEXT',
  ],
  modosActivacionSoportados: ['OPCIONAL', 'OBLIGATORIO', 'CONDICIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: true,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['metros_lineales_union', 'mutacion_aplicada'],
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'subTipo',
      etiqueta: 'Tipo de modificación',
      tipo: 'enum',
      // Preset: precarga valores y nombra el paso en la OT. No cambia la lógica.
      valoresPermitidos: ['bolsillo', 'refuerzo'],
      default: 'refuerzo',
      requerido: true,
      descripcion:
        'Bolsillo: demasía grande (100-150mm) para que entre el caño, típicamente en los lados horizontales. Refuerzo: demasía chica (30-50mm), típicamente en los 4 lados.',
    },
    {
      campo: 'lados',
      etiqueta: 'Lados afectados',
      tipo: 'multi-enum',
      valoresPermitidos: ['superior', 'inferior', 'izquierdo', 'derecho'],
      requerido: true,
      descripcion:
        'Cada lado elegido suma la demasía a su eje: superior/inferior agrandan el alto, izquierdo/derecho el ancho.',
    },
    {
      campo: 'demasiaMm',
      etiqueta: 'Demasía por lado (mm)',
      tipo: 'number',
      requerido: true,
      descripcion:
        'Milímetros que se agregan POR CADA lado elegido. Bolsillo sup+inf de 100mm sobre una lona de 1000mm de alto deja 1200mm de material.',
    },
  ],
  productosTipicos: [
    'Lona con bolsillos para caño',
    'Lona con refuerzo perimetral',
  ],
  // El motor aplica la demasía ANTES del bucle: así la ruta puede tener el
  // orden real de producción (imprimir → reforzar) sin cotizar de menos.
  mutaMedidasEnPrePasada: true,
};

const modificacion_post: DefinicionFamilia = {
  codigo: 'modificacion_post',
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

// ============================================================================
// 3.8 Logística / instalación in situ (3)
// ============================================================================

const envio: DefinicionFamilia = {
  codigo: 'envio',
  nombre: 'Envío / despacho',
  categoria: 'logistica_instalacion',
  descripcion:
    'Envío del producto al cliente. Cargos directos asociados (combustible, flete).',
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
  outputsCanonicos: ['envios_realizados'],
  validaciones: [],
  paramsPasoSchema: [],
};

const instalacion_in_situ: DefinicionFamilia = {
  codigo: 'instalacion_in_situ',
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

const toma_medidas: DefinicionFamilia = {
  codigo: 'toma_medidas',
  nombre: 'Toma de medidas en sitio',
  categoria: 'logistica_instalacion',
  descripcion:
    'Visita al cliente para tomar medidas antes de cotizar / producir.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-1'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['visitas_realizadas'],
  validaciones: [],
  paramsPasoSchema: [],
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
  proof,
  impresion_por_hoja,
  impresion_por_area,
  impresion_por_pieza,
  aplicacion_transfer,
  grabado_laser,
  corte_guillotina,
  plotter_corte,
  corte_laser,
  troquelado_digital,
  cnc,
  plegado,
  perforado,
  corte_manual,
  laminado,
  plastificado_pouch,
  barniz,
  acabado_decorativo,
  pintura_superficial,
  lijado_canteado,
  encuadernado_engrapado,
  encuadernado_anillado,
  engomado_emblocado,
  armado_cajas,
  soldadura,
  montaje_sobre_sustrato,
  ensamble_estructural,
  instalacion_electrica,
  embalaje,
  conteo_manual,
  atado_banding,
  etiquetado_manual,
  control_calidad,
  trabajo_manual,
  modificacion_pre,
  modificacion_post,
  colocacion_ojales,
  envio,
  instalacion_in_situ,
  toma_medidas,
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
// TENANT (tabla FamiliaTenant). Este registro en memoria las hace resolubles
// de forma SÍNCRONA, que es como el motor y todos los consumidores leen
// familias — async-ificar ~10 call sites del motor sería mucho más invasivo.
//
// Quién lo llena: FamiliasTenantService — carga todo al bootear el módulo y
// escribe-through en cada alta/edición/borrado. Trade-off asumido y
// documentado en el plan: con VARIAS instancias del API una edición tarda
// hasta el próximo boot en verse en las otras; hoy corre una sola.
//
// El registro guarda TAMBIÉN las inhabilitadas: el resolver resuelve siempre
// (una OT histórica tiene que poder mostrar su paso); `activo` sólo filtra
// selectores y wizard (decisión §8.6 del diseño).

const REGISTRO_TENANT = new Map<string, DefinicionFamiliaResuelta>();

/** Reemplaza el registro entero (boot del módulo). */
export function cargarRegistroFamiliasTenant(
  defs: DefinicionFamiliaResuelta[],
): void {
  REGISTRO_TENANT.clear();
  for (const def of defs) REGISTRO_TENANT.set(def.codigo, def);
}

/** Alta o edición: escribe-through desde el service. */
export function registrarFamiliaTenant(def: DefinicionFamiliaResuelta): void {
  REGISTRO_TENANT.set(def.codigo, def);
}

/** Borrado físico (sólo familias vírgenes): sale del registro. */
export function quitarFamiliaTenantDelRegistro(id: string): void {
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
export function campoSeparacionMaquinaDeFamilia(
  codigo: string,
): string | null {
  return resolverFamilia(codigo)?.campoSeparacionMaquina ?? null;
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

/**
 * Superficie sobre la que acomoda una familia de TENANT (la que eligió en el
 * wizard), o null si no aplica. Sólo devuelve algo para familias de tenant que
 * declararon superficie: las del sistema acomodan por su propio ruteo y las de
 * tenant sin superficie (T-2) no acomodan. El motor lo usa para el guard
 * genérico "no pudo acomodar" que las familias del sistema tienen a mano.
 */
export function superficieDeFamiliaTenant(
  familia: DefinicionFamiliaResuelta | null | undefined,
): string | null {
  if (!familia?.esDeTenant) return null;
  return familia.nestingConfig?.superficie ?? null;
}

/** Magnitud que alimenta la productividad cuando el modelador no eligió una.
 *  [Etapa A] */
export function magnitudTiempoDefaultDeFamilia(
  codigo: string,
): string | null {
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
 * La familia muta medidas del JobContext y el motor la resuelve en la
 * PRE-PASADA, antes del bucle. Ver `mutaMedidasEnPrePasada` en types.ts.
 */
export function familiaMutaMedidasEnPrePasada(familiaCodigo: string): boolean {
  return resolverFamilia(familiaCodigo)?.mutaMedidasEnPrePasada === true;
}
