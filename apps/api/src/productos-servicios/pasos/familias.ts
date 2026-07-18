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
  FamiliaCodigo,
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
  nombre: 'Pre-prensa / armado de imposición',
  categoria: 'pre_prensa',
  descripcion:
    'Cálculo de imposición sobre el pliego/placa madre, definición de cortes, posiblemente nesting.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-1'],
  mecanismosCantidadSoportados: [
    'DIRECT_FROM_JOBCONTEXT',
    'CALCULADO_POR_PASO',
  ],
  modosActivacionSoportados: ['OBLIGATORIO'],
  modoActivacionDefault: 'OBLIGATORIO',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: [],
  inputsRequeridos: ['cantidad'],
  outputsCanonicos: [
    'imposicion_calculada',
    'pliegos_calculados',
    'cortes_calculados',
    'poses_por_pliego',
    'pliego_impresion_ancho_mm',
    'pliego_impresion_alto_mm',
    'pliego_impresion_area_m2',
    'pliego_impresion_mp_variante_id',
    'talonario_pilas',
  ],
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
  inputsRequeridos: ['cantidad', 'caras'],
  outputsCanonicos: [
    'pliegos_calculados',
    'pliegos_impresos',
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
    {
      codigo: 'maquina_soporta_gramaje',
      tipo: 'COMPARE',
      campoJobContext: 'gramajeGr',
      fuenteB: 'MAQUINA',
      campoB: 'gramajeMaxGr',
      operador: '<=',
      mensaje:
        'Gramaje del papel ({jc.gramajeGr}gr) excede capacidad de la máquina ({maq.gramajeMaxGr}gr)',
    },
  ],
  paramsPasoSchema: [],
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
    },
  ],
  permiteSlotsAdicionales: false,
  plantillasCompatibles: ['LAMINADORA_BOPP_ROLLO'],
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
    'Modificación física que MUTA el JobContext (medidas, etc.) antes de los pasos de producción. Ej: bolsillos en lona, refuerzos en bordes, dobladillo.',
  relacionMaquinaSoportada: ['M-0'],
  modosTiempoSoportados: ['T-1', 'T-2'],
  mecanismosCantidadSoportados: ['DIRECT_FROM_JOBCONTEXT'],
  modosActivacionSoportados: ['OPCIONAL'],
  modoActivacionDefault: 'OPCIONAL',
  multiplicadoresSoportados: [],
  slotsRequeridos: [],
  permiteSlotsAdicionales: true,
  plantillasCompatibles: [],
  inputsRequeridos: [],
  outputsCanonicos: ['mutacion_aplicada'],
  validaciones: [],
  paramsPasoSchema: [
    {
      campo: 'subTipo',
      etiqueta: 'Sub-tipo de modificación',
      tipo: 'enum',
      valoresPermitidos: [
        'bolsillo_lona',
        'refuerzo_bordes',
        'dobladillo',
        'ojales_con_margen',
      ],
      requerido: true,
    },
  ],
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
  const familia = FAMILIAS[codigo as FamiliaCodigo] as
    | DefinicionFamilia
    | undefined;
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
