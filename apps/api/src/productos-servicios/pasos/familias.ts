/**
 * A.2 — Catálogo declarativo de familias de paso
 *
 * 23 familias del modelo universal (ver quiero-que-hablemos-de-dynamic-parrot.md §2).
 * Cada familia define la "forma" de un tipo de operación productiva: qué config
 * espera, qué outputs produce, qué fórmulas tiene disponibles.
 *
 * **Esto NO es código ejecutable de cotización.** Es metadata que describe el
 * universo de pasos posibles. Los motores v2 (Etapa B/C) consumirán este catálogo
 * para validar rutas y componer cálculos.
 *
 * Política de gobernanza:
 *   - Agregar familia nueva: libre, documentar el caso real que la motiva.
 *   - Modificar plantillaConfig: breaking change, requiere migración de
 *     ProductoMotorConfig existentes.
 *   - Eliminar familia: no permitido una vez usada por algún producto.
 *   - Los outputs declarados en `outputsCanonicos` deben existir en
 *     outputs-canonicos.ts.
 */

import { OUTPUTS_CANONICOS, type OutputCanonicoNombre } from './outputs-canonicos';

/** Esquema JSON minimal — placeholder. Se refinará al implementar cada motor v2. */
export type FamiliaPlantillaConfig = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
};

export type FamiliaPaso = {
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria:
    | 'produccion'
    | 'corte_y_formado'
    | 'terminaciones'
    | 'estructural'
    | 'servicios'
    | 'operaciones_manuales';
  plantillaConfig: FamiliaPlantillaConfig;
  outputsCanonicos: OutputCanonicoNombre[];
  formulasDisponibles: {
    tiempo: string[];
    material: string[];
  };
  requiereCentroCosto: boolean;
  ejemplos: string[];
};

const EMPTY_SCHEMA: FamiliaPlantillaConfig = { type: 'object', properties: {} };

export const FAMILIAS_PASO: Record<string, FamiliaPaso> = {
  // ───────────────────────────── PRODUCCIÓN ─────────────────────────────
  impresion_por_hoja: {
    codigo: 'impresion_por_hoja',
    nombre: 'Impresión por hoja',
    descripcion: 'Láser, offset, digital plano. Imposición en N piezas por placa, consume hojas, productividad en hojas/hora.',
    categoria: 'produccion',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [
      OUTPUTS_CANONICOS.piezasPorPlaca,
      OUTPUTS_CANONICOS.pliegos,
      OUTPUTS_CANONICOS.hojasImpresas,
      OUTPUTS_CANONICOS.planchasNecesarias,
      OUTPUTS_CANONICOS.impresiones,
    ],
    formulasDisponibles: { tiempo: ['setup+productivo+cleanup'], material: ['papel_por_pliego', 'toner_por_impresion'] },
    requiereCentroCosto: true,
    ejemplos: ['Tarjetas personales láser', 'Folletos offset', 'Revistas grapadas'],
  },

  impresion_por_area: {
    codigo: 'impresion_por_area',
    nombre: 'Impresión por área (gran formato)',
    descripcion: 'Látex, eco/solvente, UV rollo, plotter, sublimación. Consume sustrato por m², productividad en m²/hora.',
    categoria: 'produccion',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [
      OUTPUTS_CANONICOS.m2Impresos,
      OUTPUTS_CANONICOS.metrosLinealesConsumidos,
      OUTPUTS_CANONICOS.panelesGenerados,
      OUTPUTS_CANONICOS.areaDesperdicioM2,
    ],
    formulasDisponibles: { tiempo: ['m2_por_hora', 'ml_por_hora'], material: ['sustrato_por_m2', 'tinta_por_m2'] },
    requiereCentroCosto: true,
    ejemplos: ['Banners de lona', 'Vinilos adhesivos impresos', 'Back-lights', 'Gigantografías'],
  },

  impresion_por_pieza: {
    codigo: 'impresion_por_pieza',
    nombre: 'Impresión por pieza (rígidos, DTF UV)',
    descripcion: 'UV mesa extensora en rígidos, DTF UV sobre objetos. Se imprime sobre una pieza ya existente.',
    categoria: 'produccion',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [
      OUTPUTS_CANONICOS.piezasImpresas,
      OUTPUTS_CANONICOS.placasUsadas,
      OUTPUTS_CANONICOS.aprovechamientoPct,
    ],
    formulasDisponibles: { tiempo: ['pieza_por_hora', 'placa_por_hora'], material: ['tinta_por_pieza', 'placa_rigida'] },
    requiereCentroCosto: true,
    ejemplos: ['Cartel PVC impreso UV', 'Tazas DTF UV', 'Placas acrílico con logo'],
  },

  aplicacion_transfer: {
    codigo: 'aplicacion_transfer',
    nombre: 'Aplicación de transfer (DTF textil)',
    descripcion: 'Film DTF impreso se termofija sobre prenda. Consume tanto el film como la prenda.',
    categoria: 'produccion',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [
      OUTPUTS_CANONICOS.filmImpresoM2,
      OUTPUTS_CANONICOS.prendasTermofijadas,
    ],
    formulasDisponibles: { tiempo: ['prenda_por_hora'], material: ['film_por_arte_m2', 'prenda_cruda'] },
    requiereCentroCosto: true,
    ejemplos: ['Remeras personalizadas DTF', 'Buzos estampados'],
  },

  // ──────────────────────────── CORTE Y FORMADO ────────────────────────────
  corte: {
    codigo: 'corte',
    nombre: 'Corte plano',
    descripcion: 'Guillotina, plotter de corte, troquel. Corte de hojas o material flexible.',
    categoria: 'corte_y_formado',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [
      OUTPUTS_CANONICOS.cortesRealizados,
      OUTPUTS_CANONICOS.piezasCortadas,
      OUTPUTS_CANONICOS.metrosLinealesCortados,
    ],
    formulasDisponibles: { tiempo: ['corte_por_hora', 'min_por_corte'], material: [] },
    requiereCentroCosto: true,
    ejemplos: ['Guillotinado de tarjetas', 'Plotter de vinilo', 'Láser CO2 sobre papel'],
  },

  corte_volumetrico: {
    codigo: 'corte_volumetrico',
    nombre: 'Corte volumétrico',
    descripcion: 'CNC router, láser CO2 sobre material grueso, cortadora de polifán. Corte tridimensional o material rígido.',
    categoria: 'corte_y_formado',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [
      OUTPUTS_CANONICOS.piezasVolumetricas,
      OUTPUTS_CANONICOS.metrosLinealesCortados,
    ],
    formulasDisponibles: { tiempo: ['ml_por_hora', 'area_por_hora'], material: [] },
    requiereCentroCosto: true,
    ejemplos: ['Letras corpóreas PVC', 'Muebles MDF a medida', 'Logos polifán'],
  },

  grabado: {
    codigo: 'grabado',
    nombre: 'Grabado',
    descripcion: 'Grabado láser, mecánico o químico sobre superficies.',
    categoria: 'corte_y_formado',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [
      OUTPUTS_CANONICOS.areaGrabadaM2,
      OUTPUTS_CANONICOS.piezasGrabadas,
    ],
    formulasDisponibles: { tiempo: ['m2_grabado_por_hora'], material: [] },
    requiereCentroCosto: true,
    ejemplos: ['Grabado láser madera', 'Grabado en acrílico', 'Marcado metálico'],
  },

  plegado: {
    codigo: 'plegado',
    nombre: 'Plegado',
    descripcion: 'Plegadora automática o manual para dípticos, trípticos, libros.',
    categoria: 'corte_y_formado',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [OUTPUTS_CANONICOS.plieguesRealizados],
    formulasDisponibles: { tiempo: ['pliegues_por_hora'], material: [] },
    requiereCentroCosto: true,
    ejemplos: ['Plegado tríptico', 'Plegado folletería'],
  },

  perforado: {
    codigo: 'perforado',
    nombre: 'Perforado',
    descripcion: 'Perforación de tickets, talonarios, calendarios.',
    categoria: 'corte_y_formado',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [OUTPUTS_CANONICOS.perforacionesRealizadas],
    formulasDisponibles: { tiempo: ['perf_por_hora'], material: [] },
    requiereCentroCosto: true,
    ejemplos: ['Perforación para anillado', 'Tickets arrancables'],
  },

  troquelado: {
    codigo: 'troquelado',
    nombre: 'Troquelado',
    descripcion: 'Troquelado con forma especial usando matriz de troquel.',
    categoria: 'corte_y_formado',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [OUTPUTS_CANONICOS.troquelesUsados, OUTPUTS_CANONICOS.piezasCortadas],
    formulasDisponibles: { tiempo: ['golpe_por_hora'], material: ['matriz_troquel'] },
    requiereCentroCosto: true,
    ejemplos: ['Cajas plegables', 'Tarjetas con esquinas redondeadas', 'Packaging rígido'],
  },

  // ────────────────────────────── TERMINACIONES ──────────────────────────────
  laminado: {
    codigo: 'laminado',
    nombre: 'Laminado',
    descripcion: 'Plastificado mate/brillo, UV, anti-rayadura. Aplicación de película protectora.',
    categoria: 'terminaciones',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [
      OUTPUTS_CANONICOS.peliculaLaminadaM2,
      OUTPUTS_CANONICOS.piezasLaminadas,
    ],
    formulasDisponibles: { tiempo: ['m2_laminado_por_hora'], material: ['film_por_m2'] },
    requiereCentroCosto: true,
    ejemplos: ['Laminado brillo tarjetas', 'Plastificado menús', 'UV anti-rayadura'],
  },

  acabado_decorativo: {
    codigo: 'acabado_decorativo',
    nombre: 'Acabado decorativo',
    descripcion: 'Foil dorado/plateado, hot-stamping, relieve en seco o con tinta.',
    categoria: 'terminaciones',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [OUTPUTS_CANONICOS.areaDecoradaM2],
    formulasDisponibles: { tiempo: ['m2_decorado_por_hora'], material: ['foil_por_m2'] },
    requiereCentroCosto: true,
    ejemplos: ['Foil dorado en invitaciones', 'Hot-stamping tarjetas premium', 'Relieve en tapas'],
  },

  pintura_superficial: {
    codigo: 'pintura_superficial',
    nombre: 'Pintura superficial',
    descripcion: 'Pintura líquida, esmalte, barniz, anti-corrosivo. Distinto de laminado (film).',
    categoria: 'terminaciones',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [OUTPUTS_CANONICOS.areaPintadaM2],
    formulasDisponibles: { tiempo: ['m2_pintado_por_hora'], material: ['pintura_por_m2'] },
    requiereCentroCosto: true,
    ejemplos: ['Pintado estructura herrería', 'Barniz sobre MDF', 'Anti-corrosivo exterior'],
  },

  encuadernado: {
    codigo: 'encuadernado',
    nombre: 'Encuadernado',
    descripcion: 'Hot-melt, cosido, anillado, espiralado, abrochado. Une hojas en un objeto final.',
    categoria: 'terminaciones',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [
      OUTPUTS_CANONICOS.cuadernosTerminados,
      OUTPUTS_CANONICOS.espiralesConsumidas,
      OUTPUTS_CANONICOS.grapasUsadas,
      OUTPUTS_CANONICOS.metrosCosido,
    ],
    formulasDisponibles: { tiempo: ['cuaderno_por_hora'], material: ['espiral_por_cuaderno', 'grapa_por_talonario'] },
    requiereCentroCosto: true,
    ejemplos: ['Libros tapa dura cosidos', 'Talonarios abrochados', 'Cuadernos anillados'],
  },

  // ─────────────────────────── ESTRUCTURAL ───────────────────────────
  soldadura_herreria: {
    codigo: 'soldadura_herreria',
    nombre: 'Soldadura / herrería',
    descripcion: 'Estructuras metálicas, tótems, soportes, caballetes.',
    categoria: 'estructural',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [OUTPUTS_CANONICOS.metrosSoldados],
    formulasDisponibles: { tiempo: ['metros_soldados_por_hora'], material: ['perfil_por_metro', 'electrodos'] },
    requiereCentroCosto: true,
    ejemplos: ['Tótem de cartelería', 'Estructura de caja de luz', 'Pedestales'],
  },

  ensamble_estructural: {
    codigo: 'ensamble_estructural',
    nombre: 'Ensamble estructural',
    descripcion: 'Unir piezas heterogéneas. Paso de convergencia (DAG): consume outputs de múltiples pasos previos.',
    categoria: 'estructural',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [OUTPUTS_CANONICOS.piezasEnsambladas],
    formulasDisponibles: { tiempo: ['pieza_por_hora'], material: ['tornilleria', 'adhesivos'] },
    requiereCentroCosto: true,
    ejemplos: ['Armado caja de luz (estructura + acrílico + LED + letras)', 'Ensamble mobiliario'],
  },

  instalacion_electrica: {
    codigo: 'instalacion_electrica',
    nombre: 'Instalación eléctrica',
    descripcion: 'LED, fuentes, cableado, conexiones.',
    categoria: 'estructural',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [
      OUTPUTS_CANONICOS.modulosLEDInstalados,
      OUTPUTS_CANONICOS.metrosCableado,
    ],
    formulasDisponibles: { tiempo: ['modulo_por_hora'], material: ['led_por_metro', 'fuente'] },
    requiereCentroCosto: true,
    ejemplos: ['Letras corpóreas iluminadas', 'Caja de luz LED', 'Neón LED flexible'],
  },

  // ─────────────────────────── SERVICIOS ───────────────────────────
  pre_prensa: {
    codigo: 'pre_prensa',
    nombre: 'Pre-prensa',
    descripcion: 'Preparación del arte para producción: perfiles de color, imposición, prueba de color.',
    categoria: 'servicios',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [OUTPUTS_CANONICOS.horasPrePrensa],
    formulasDisponibles: { tiempo: ['horas_fijas', 'horas_por_archivo'], material: [] },
    requiereCentroCosto: true,
    ejemplos: ['Preparación de archivo para offset', 'Prueba de color digital'],
  },

  diseno_grafico: {
    codigo: 'diseno_grafico',
    nombre: 'Diseño gráfico',
    descripcion: 'Creación de arte desde cero o adaptación. Distinto de pre-prensa (que es técnico).',
    categoria: 'servicios',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [OUTPUTS_CANONICOS.horasDiseno],
    formulasDisponibles: { tiempo: ['horas_por_nivel'], material: [] },
    requiereCentroCosto: true,
    ejemplos: ['Diseño logo', 'Adaptación a medida', 'Retoque de imagen'],
  },

  toma_medidas: {
    codigo: 'toma_medidas',
    nombre: 'Toma de medidas',
    descripcion: 'Servicio pre-producción en obra del cliente: medir, relevar superficies, tomar datos.',
    categoria: 'servicios',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [
      OUTPUTS_CANONICOS.visitaMedidasRealizada,
      OUTPUTS_CANONICOS.kmTraslado,
    ],
    formulasDisponibles: { tiempo: ['visita_fija', 'horas_operario'], material: [] },
    requiereCentroCosto: true,
    ejemplos: ['Medidas para wrap vehicular', 'Relevamiento cartelería en local', 'Toma de datos vidriera'],
  },

  colocacion_in_situ: {
    codigo: 'colocacion_in_situ',
    nombre: 'Colocación in-situ',
    descripcion: 'Instalación en el cliente: wrap vehicular, vinilo en vidriera, cartel en local. Incluye traslado.',
    categoria: 'servicios',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [
      OUTPUTS_CANONICOS.horasInstalacionInSitu,
      OUTPUTS_CANONICOS.kmTraslado,
    ],
    formulasDisponibles: { tiempo: ['horas_operario', 'operarios_x_horas'], material: ['viaticos', 'combustible'] },
    requiereCentroCosto: true,
    ejemplos: ['Wrap vehicular', 'Colocación vinilo vidriera', 'Instalación cartel tótem'],
  },

  // ───────────────────────── OPERACIONES MANUALES ─────────────────────────
  operacion_manual: {
    codigo: 'operacion_manual',
    nombre: 'Operación manual',
    descripcion: 'Armado, embolsado, conteo, inserto, empaquetado. Tiempo humano sobre material ya terminado.',
    categoria: 'operaciones_manuales',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [
      OUTPUTS_CANONICOS.piezasEmbaladas,
      OUTPUTS_CANONICOS.piezasArmadas,
    ],
    formulasDisponibles: { tiempo: ['piezas_por_hora'], material: ['bolsas', 'cajas'] },
    requiereCentroCosto: true,
    ejemplos: ['Embolsado individual', 'Conteo final', 'Inserto promocional en sobres'],
  },

  insumo_externo_gestion: {
    codigo: 'insumo_externo_gestion',
    nombre: 'Gestión de insumo externo',
    descripcion: 'Compra tercerizada de insumo específico (LED, fuente, perfil, acrílico cortado a medida) con tiempo administrativo mínimo.',
    categoria: 'operaciones_manuales',
    plantillaConfig: EMPTY_SCHEMA,
    outputsCanonicos: [OUTPUTS_CANONICOS.insumosGestionados],
    formulasDisponibles: { tiempo: ['horas_gestion_min'], material: ['insumo_externo_monto_flat'] },
    requiereCentroCosto: true,
    ejemplos: ['Compra de LEDs', 'Pedido de perfil metálico', 'Tercerización de troquelado'],
  },
};

/**
 * Listado ordenado de códigos de familia.
 */
export const FAMILIAS_CODIGOS = Object.keys(FAMILIAS_PASO);

/**
 * Devuelve la familia o undefined si el código no existe.
 */
export function getFamilia(codigo: string): FamiliaPaso | undefined {
  return FAMILIAS_PASO[codigo];
}

/**
 * Lista las familias que pertenecen a una categoría dada.
 */
export function getFamiliasPorCategoria(categoria: FamiliaPaso['categoria']): FamiliaPaso[] {
  return Object.values(FAMILIAS_PASO).filter((f) => f.categoria === categoria);
}
