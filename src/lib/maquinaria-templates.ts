/**
 * Catálogo de plantillas de maquinaria — modelo v3.0 (2026-04-26).
 *
 * Doc: `docs/motor-por-pasos-analisis/06-maquinas-y-perfiles.md` §5–§13.
 *
 * Cada plantilla declara las secciones y campos que el frontend renderiza
 * para crear/editar una máquina. Los campos son los EXACTOS que el doc
 * declara para cada plantilla — no se inventan campos extras.
 *
 * Estructura por sección:
 *   - capacidades_fisicas → columnas universales de Maquina (anchoUtil, etc.).
 *   - parametros_tecnicos → claves específicas en `parametrosTecnicosJson`.
 *   - perfiles_operativos → universales del PerfilOperativo + discriminantes
 *     que viven en `perfil.detalle`.
 *   - consumibles → MaquinaConsumible.
 *   - desgaste_repuestos → MaquinaComponenteDesgaste.
 */

import {
  maquinariaBaseSectionOrder,
  type MaquinariaTemplateDefinition,
  type MaquinariaTemplateField,
  type MaquinariaTemplateOption,
  type MaquinariaTemplateSection,
  type PlantillaMaquinaria,
} from "@/lib/maquinaria";

function option(value: string, label: string, description?: string): MaquinariaTemplateOption {
  return { value, label, description };
}

function field(definition: MaquinariaTemplateField): MaquinariaTemplateField {
  return definition;
}

function section(definition: MaquinariaTemplateSection): MaquinariaTemplateSection {
  return definition;
}

function template(definition: MaquinariaTemplateDefinition): MaquinariaTemplateDefinition {
  return definition;
}

// ─── Opciones reutilizables (alineadas al doc) ────────────────────

const coloresImpresorLaserOptions = [
  option("BN", "Blanco y Negro"),
  option("CMYK", "CMYK"),
];

const carasOptions = [
  option("SIMPLE_FAZ", "Simple faz"),
  option("DOBLE_FAZ", "Doble faz"),
];

const tecnologiaGranFormatoOptions = [
  option("LATEX", "Látex"),
  option("SOLVENTE", "Solvente"),
  option("UV", "UV"),
  option("SUBLIMACION", "Sublimación"),
  option("DTF_UV", "DTF UV"),
  option("DTF_TEXTIL", "DTF Textil"),
];

const geometriaGranFormatoOptions = [
  option("ROLLO", "Rollo"),
  option("MESA_EXTENSORA", "Mesa extensora"),
];

const coloresGranFormatoOptions = [
  option("CMYK", "CMYK"),
  option("CMYK+blanco", "CMYK + Blanco"),
  option("CMYK+barniz", "CMYK + Barniz"),
  option("CMYK+blanco+barniz", "CMYK + Blanco + Barniz"),
];

const tipoCorteOptions = [
  option("COMPLETO", "Corte completo"),
  option("KISS_CUT", "Kiss cut"),
];

const modoOperacionPlotterOptions = [
  option("ROLLO", "Rollo"),
  option("HOJAS", "Hojas"),
];

const factorComplejidadPlotterOptions = [
  option("simple", "Simple"),
  option("intermedio", "Intermedio"),
  option("complejo", "Complejo"),
  option("personalizado", "Personalizado"),
];

const modoLaminadoOptions = [
  option("UNA_CARA", "Una cara"),
  option("DOS_CARAS_1_PASADA", "Dos caras (1 pasada)"),
  option("DOS_CARAS_2_PASADAS", "Dos caras (2 pasadas)"),
];

const tipoLaserOptions = [option("CO2", "CO2"), option("FIBRA", "Fibra")];

const operacionesLaserOptions = [
  option("CORTE", "Corte"),
  option("GRABADO", "Grabado"),
];

const operacionesCncOptions = [
  option("CORTE_PASANTE", "Corte pasante"),
  option("FRESADO", "Fresado"),
  option("PERFORADO", "Perforado"),
];

const tipoTrabajoCadOptions = [
  option("CAD", "CAD (técnico)"),
  option("FOTO", "Foto"),
];

const calidadCadOptions = [
  option("DRAFT", "Borrador"),
  option("NORMAL", "Normal"),
  option("ALTA", "Alta"),
];

const tipoAnilloOptions = [
  option("ESPIRAL_PLASTICO", "Espiral plástico"),
  option("WIRE_O", "Wire-O"),
];

const pasosOrificiosOptions = [
  option("3:1", "Paso 3:1"),
  option("2:1", "Paso 2:1"),
];

// ─── Secciones comunes a todas las plantillas ─────────────────────

const commonTemplateSections = maquinariaBaseSectionOrder;

const genericConsumableFields: MaquinariaTemplateField[] = [
  field({
    key: "nombre",
    label: "Nombre",
    scope: "consumible",
    kind: "text",
    required: true,
    description: "Nombre técnico o comercial del consumible.",
    placeholder: "Tóner negro",
  }),
  field({
    key: "tipo",
    label: "Tipo",
    scope: "consumible",
    kind: "select",
    required: true,
    description: "Categoría del consumible.",
    options: [
      option("toner", "Tóner"),
      option("tinta", "Tinta"),
      option("barniz", "Barniz"),
      option("primer", "Primer"),
      option("film", "Film"),
      option("polvo", "Polvo"),
      option("adhesivo", "Adhesivo"),
      option("resina", "Resina"),
      option("lubricante", "Lubricante"),
      option("otro", "Otro"),
    ],
  }),
  field({
    key: "unidad",
    label: "Unidad",
    scope: "consumible",
    kind: "select",
    required: true,
    description: "Unidad en la que se mide el consumo.",
    options: [
      option("ml", "ml"),
      option("litro", "Litro"),
      option("gramo", "g"),
      option("kg", "kg"),
      option("unidad", "Unidad"),
      option("m2", "m²"),
      option("metro_lineal", "m lineal"),
    ],
  }),
  field({
    key: "consumoBase",
    label: "Consumo base",
    scope: "consumible",
    kind: "number",
    description: "Cantidad consumida por unidad de producción (m², pliego, etc.).",
  }),
];

const genericWearFields: MaquinariaTemplateField[] = [
  field({
    key: "nombre",
    label: "Componente",
    scope: "desgaste",
    kind: "text",
    required: true,
    description: "Nombre del componente de desgaste.",
    placeholder: "Cabezal de impresión",
  }),
  field({
    key: "tipo",
    label: "Tipo",
    scope: "desgaste",
    kind: "select",
    required: true,
    description: "Categoría del componente.",
    options: [
      option("cabezal", "Cabezal"),
      option("lampara_uv", "Lámpara UV"),
      option("fresa", "Fresa"),
      option("cuchilla", "Cuchilla"),
      option("filtro", "Filtro"),
      option("kit_mantenimiento", "Kit de mantenimiento"),
      option("otro", "Otro"),
    ],
  }),
  field({
    key: "vidaUtilEstimada",
    label: "Vida útil estimada",
    scope: "desgaste",
    kind: "number",
    description: "Cantidad procesada hasta agotar el componente.",
  }),
  field({
    key: "unidadDesgaste",
    label: "Unidad de vida útil",
    scope: "desgaste",
    kind: "select",
    required: true,
    description: "Unidad en la que se mide la vida útil del componente.",
    options: [
      option("copias_a4_equiv", "Copias A4-eq"),
      option("m2", "m²"),
      option("metros_lineales", "m lineales"),
      option("horas", "horas"),
      option("ciclos", "ciclos"),
      option("piezas", "piezas"),
    ],
  }),
];

// ─── Builders por plantilla (alineados a doc §5–§13) ──────────────

/** §5 — Capacidades físicas universales + paramsTecnicos de IMPRESORA_LASER. */
function buildLaserSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Medidas máximas de pliego soportadas por la máquina.",
      fields: [
        field({ key: "anchoUtil", label: "Ancho útil máximo", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Ancho máx de pliego (ej. 320mm)." }),
        field({ key: "largoUtil", label: "Largo útil máximo", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Largo máx de pliego (ej. 1200mm)." }),
        field({ key: "gramajeMaxGr", label: "Gramaje máximo", scope: "maquina", kind: "number", unit: "g_m2", required: true, description: "Gramaje máx de papel (ej. 400gr)." }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Configuración específica de la impresora láser.",
      fields: [
        field({ key: "margenesNoImprimiblesMm", label: "Márgenes no imprimibles", scope: "maquina", kind: "textarea", required: true, description: "Distancia que la máquina no puede imprimir en cada borde." }),
        field({ key: "soporteDobleFaz", label: "Soporta doble faz", scope: "maquina", kind: "boolean", description: "Si la máquina puede imprimir ambas caras." }),
        field({ key: "coloresSoportados", label: "Colores soportados", scope: "maquina", kind: "multiselect", options: coloresImpresorLaserOptions, description: "Modos de color disponibles." }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Cada perfil describe una combinación cara/color/formato/gramaje con su productividad.",
      fields: [
        field({ key: "nombre", label: "Nombre del perfil", scope: "perfil_operativo", kind: "text", required: true, description: "Ej. Papel grueso doble faz." }),
        field({ key: "productivityValue", label: "Productividad", scope: "perfil_operativo", kind: "number", unit: "ppm", required: true, description: "Pliegos por minuto." }),
        field({ key: "setupMin", label: "Setup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de preparación inicial." }),
        field({ key: "cleanupMin", label: "Cleanup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de limpieza al terminar." }),
        field({ key: "feedReloadMin", label: "Recarga papel", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de recarga entre tandas." }),
        field({ key: "caras", label: "Caras", scope: "perfil_operativo", kind: "select", required: true, options: carasOptions, description: "Discriminante: simple o doble faz." }),
        field({ key: "colores", label: "Modos de color admitidos", scope: "perfil_operativo", kind: "multiselect", options: coloresImpresorLaserOptions, description: "Modos comerciales que puede imprimir este perfil." }),
        field({ key: "gramajeMinGr", label: "Gramaje mínimo", scope: "perfil_operativo", kind: "number", unit: "g_m2", description: "Gramaje mínimo del rango." }),
        field({ key: "gramajeMaxGr", label: "Gramaje máximo", scope: "perfil_operativo", kind: "number", unit: "g_m2", description: "Gramaje máximo del rango." }),
      ],
    }),
    section({ id: "consumibles", title: "Consumibles", description: "Tóner declarado por máquina.", fields: genericConsumableFields }),
    section({ id: "desgaste_repuestos", title: "Desgaste y repuestos", description: "Fusor, drum, transferencia, etc.", fields: genericWearFields }),
  ];
}

/** §6 — IMPRESORA_GRAN_FORMATO_POR_AREA con discriminantes tecnologia + geometria. */
function buildGranFormatoSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Tecnología y geometría definen las variantes de esta plantilla unificada.",
      fields: [
        field({ key: "tecnologia", label: "Tecnología", scope: "maquina", kind: "select", required: true, options: tecnologiaGranFormatoOptions, description: "Tipo de impresión (LATEX, UV, etc.)." }),
        field({ key: "geometria", label: "Geometría", scope: "maquina", kind: "select", required: true, options: geometriaGranFormatoOptions, description: "Rollo o mesa extensora." }),
        // Sin anchoMinRolloMm ni alturaMaxCabezalMm (decisión 2026-07-28):
        // nadie los leía —ni el motor ni ninguna validación—; eran datos
        // decorativos. Si algún día se valida compatibilidad material↔máquina,
        // se reintroducen junto con esa validación.
        field({ key: "anchoMaxRolloMm", label: "Ancho máximo de rollo", scope: "maquina", kind: "number", unit: "mm", description: "Se usa cuando la máquina admite trabajos en rollo." }),
        field({ key: "anchoMesaMm", label: "Ancho de mesa", scope: "maquina", kind: "number", unit: "mm", description: "Se usa cuando la geometría es Mesa extensora." }),
        field({ key: "largoMesaMm", label: "Largo de mesa", scope: "maquina", kind: "number", unit: "mm", description: "Se usa cuando la geometría es Mesa extensora." }),
        field({ key: "soportaCorteIntegrado", label: "Soporta corte integrado", scope: "maquina", kind: "boolean", description: "Permite usar perfiles de corte en esta impresora para trabajos tipo plotter." }),
        field({ key: "margenesNoImprimiblesMm", label: "Márgenes no imprimibles", scope: "maquina", kind: "textarea", required: true, description: "Distancia que la máquina no puede imprimir en cada borde." }),
        field({ key: "coloresSoportados", label: "Colores soportados", scope: "maquina", kind: "multiselect", options: coloresGranFormatoOptions, description: "Modos de color (CMYK, +blanco, +barniz)." }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Cada perfil define productividad y canales de impresión.",
      fields: [
        field({ key: "nombre", label: "Nombre del perfil", scope: "perfil_operativo", kind: "text", required: true, description: "Ej. Latex CMYK normal." }),
        field({ key: "productivityValue", label: "Productividad", scope: "perfil_operativo", kind: "number", unit: "m2_h", required: true, description: "m²/hora." }),
        field({ key: "setupMin", label: "Setup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de preparación inicial." }),
        field({ key: "cleanupMin", label: "Cleanup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de limpieza al terminar." }),
        field({ key: "feedReloadMin", label: "Recarga rollo", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de recarga de rollo." }),
        field({ key: "colores", label: "Colores", scope: "perfil_operativo", kind: "select", options: coloresGranFormatoOptions, description: "Modo de color del perfil." }),
        field({ key: "tipoCorte", label: "Tipo de corte", scope: "perfil_operativo", kind: "select", options: tipoCorteOptions, description: "Se usa en perfiles de corte integrado." }),
        field({ key: "factorComplejidad", label: "Factor complejidad (JSON)", scope: "perfil_operativo", kind: "textarea", description: "Se usa en perfiles de corte integrado. Ej: { SIMPLE: 1.0, INTERMEDIO: 1.5, COMPLEJO: 3.0 }." }),
      ],
    }),
    section({ id: "consumibles", title: "Consumibles", description: "Tinta CMYK, blanca, barniz por perfil.", fields: genericConsumableFields }),
    // Sin desgaste_repuestos: decisión 2026-07-28 — en gran formato por área
    // no se registran piezas de desgaste (el costeo por desgaste está en
    // standby y acá ni siquiera se va a cargar el dato).
  ];
}

/** §7 — GUILLOTINA con fórmula no lineal (productividad NULL). */
function buildGuillotinaSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Largo de cuchilla, profundidad de mesa, altura física máx de pila.",
      fields: [
        field({ key: "anchoUtil", label: "Largo de cuchilla", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Ancho máx de pliego = largo de la cuchilla." }),
        field({ key: "largoUtil", label: "Profundidad de mesa", scope: "maquina", kind: "number", unit: "mm", description: "Profundidad útil de la mesa." }),
        field({ key: "altoUtil", label: "Altura máx de boca", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Altura física máx de pila (ej. 165mm)." }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Tiempo por corte (constante en la máquina, casi no varía con material).",
      fields: [
        field({ key: "tiempoPorCorteSeg", label: "Tiempo por corte", scope: "maquina", kind: "number", unit: "seg", required: true, description: "Segundos por cada corte individual (ej. 8)." }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos por rango de material",
      description: "Un perfil por rango de gramaje. La capacidad varía con el grosor.",
      fields: [
        field({ key: "nombre", label: "Nombre del perfil", scope: "perfil_operativo", kind: "text", required: true, description: "Ej. Papel grueso 100-250gr." }),
        field({ key: "setupMin", label: "Setup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de preparación inicial." }),
        field({ key: "cleanupMin", label: "Cleanup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de limpieza." }),
        field({ key: "feedReloadMin", label: "Tiempo entre tandas", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo para preparar la siguiente tanda." }),
        field({ key: "gramajeMinGr", label: "Gramaje mínimo", scope: "perfil_operativo", kind: "number", unit: "g_m2", description: "Gramaje mínimo del rango." }),
        field({ key: "gramajeMaxGr", label: "Gramaje máximo", scope: "perfil_operativo", kind: "number", unit: "g_m2", required: true, description: "Gramaje máximo del rango." }),
        field({ key: "pliegosMaxPorTanda", label: "Pliegos máx por tanda", scope: "perfil_operativo", kind: "number", required: true, description: "Cantidad máx de pliegos que entran en una tanda (ej. 500)." }),
      ],
    }),
    section({ id: "desgaste_repuestos", title: "Desgaste y repuestos", description: "Cuchilla y tabla de corte.", fields: genericWearFields }),
  ];
}

/** §8 — PLOTTER_DE_CORTE con discriminantes tipoCorte + modoOperacion. */
function buildPlotterCorteSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Ancho máximo de rollo aceptado.",
      fields: [
        field({ key: "anchoUtil", label: "Ancho útil", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Ancho máx de rollo (ej. 600mm)." }),
        field({ key: "espesorMaximo", label: "Espesor máximo", scope: "maquina", kind: "number", unit: "mm", description: "Vinilo, films delgados (ej. 1mm)." }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Rangos de rollo y modos soportados.",
      fields: [
        // Sin anchoMinRolloMm (decisión 2026-07-28): nadie lo leía, mismo caso
        // que en gran formato.
        field({ key: "anchoMaxRolloMm", label: "Ancho máximo de rollo", scope: "maquina", kind: "number", unit: "mm", description: "Máximo de rollo aceptado." }),
        field({ key: "modosOperacionSoportados", label: "Modos soportados", scope: "maquina", kind: "multiselect", required: true, options: modoOperacionPlotterOptions, description: "Rollo y/o hojas." }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Por tipo de corte + modo de operación. Complejidad la elige el comercial al cotizar.",
      fields: [
        field({ key: "nombre", label: "Nombre del perfil", scope: "perfil_operativo", kind: "text", required: true, description: "Ej. Corte completo - rollo." }),
        field({ key: "productivityValue", label: "Productividad", scope: "perfil_operativo", kind: "number", unit: "m2_h", required: true, description: "m²/hora base (cortes simples)." }),
        field({ key: "setupMin", label: "Setup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de carga de rollo y calibración." }),
        field({ key: "cleanupMin", label: "Cleanup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de limpieza." }),
        field({ key: "feedReloadMin", label: "Cambio de rollo", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo entre rollos." }),
        field({ key: "tipoCorte", label: "Tipo de corte", scope: "perfil_operativo", kind: "select", required: true, options: tipoCorteOptions, description: "Completo (atraviesa) o kiss-cut (solo vinilo)." }),
        field({ key: "modoOperacion", label: "Modo operación", scope: "perfil_operativo", kind: "select", options: modoOperacionPlotterOptions, description: "Rollo u hojas." }),
        field({ key: "factorComplejidad", label: "Factor de complejidad", scope: "perfil_operativo", kind: "select", options: factorComplejidadPlotterOptions, description: "" }),
      ],
    }),
    section({ id: "desgaste_repuestos", title: "Desgaste y repuestos", description: "Cuchilla.", fields: genericWearFields }),
  ];
}

/** §10 — PLOTTER_CAD con discriminantes tipoTrabajo + calidad. */
function buildPlotterCadSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Ancho máx de rollo (típico 1067mm = 42 pulgadas).",
      fields: [
        field({ key: "anchoUtil", label: "Ancho útil máximo", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Ancho máx de rollo." }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Rangos de rollo, márgenes y colores soportados.",
      fields: [
        // Sin anchoMinRolloMm (decisión 2026-07-28): nadie lo leía, mismo caso
        // que en gran formato.
        field({ key: "anchoMaxRolloMm", label: "Ancho máximo de rollo", scope: "maquina", kind: "number", unit: "mm", description: "Máximo aceptado." }),
        field({ key: "margenesNoImprimiblesMm", label: "Márgenes no imprimibles", scope: "maquina", kind: "textarea", required: true, description: "Distancia que la máquina no puede imprimir en cada borde." }),
        field({ key: "coloresSoportados", label: "Colores soportados", scope: "maquina", kind: "multiselect", options: [option("CMYK", "CMYK")], description: "Solo CMYK típicamente." }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Por tipo de trabajo + calidad. Cambian abismalmente velocidad y consumo de tinta.",
      fields: [
        field({ key: "nombre", label: "Nombre del perfil", scope: "perfil_operativo", kind: "text", required: true, description: "Ej. CAD - Borrador, Foto - Alta." }),
        field({ key: "productivityValue", label: "Productividad", scope: "perfil_operativo", kind: "number", unit: "m2_h", required: true, description: "m²/hora del perfil." }),
        field({ key: "setupMin", label: "Setup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de calibración." }),
        field({ key: "cleanupMin", label: "Cleanup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de limpieza." }),
        field({ key: "feedReloadMin", label: "Cambio de rollo", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo entre rollos." }),
        field({ key: "tipoTrabajo", label: "Tipo de trabajo", scope: "perfil_operativo", kind: "select", required: true, options: tipoTrabajoCadOptions, description: "CAD (rápido, baja densidad) o FOTO (lento, alta densidad)." }),
        field({ key: "calidad", label: "Calidad", scope: "perfil_operativo", kind: "select", required: true, options: calidadCadOptions, description: "Borrador, normal o alta." }),
        field({ key: "colores", label: "Modos de color admitidos", scope: "perfil_operativo", kind: "multiselect", options: coloresImpresorLaserOptions, description: "Modos comerciales que puede imprimir este perfil (B/N para planos, CMYK para color)." }),
      ],
    }),
    section({ id: "consumibles", title: "Consumibles", description: "Tinta CMYK por perfil.", fields: genericConsumableFields }),
    section({ id: "desgaste_repuestos", title: "Desgaste y repuestos", description: "Cabezal por ml de tinta procesada.", fields: genericWearFields }),
  ];
}

/** §9 — LAMINADORA_BOPP_ROLLO con perfil único "Estándar". */
function buildLaminadoraBoppSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Ancho máx de pliego que pasa.",
      fields: [
        field({ key: "anchoUtil", label: "Ancho útil máximo", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Ancho máx de pliego." }),
        field({ key: "espesorMaximo", label: "Espesor máximo", scope: "maquina", kind: "number", unit: "micrones", description: "Espesor máximo admitido, declarado en micrones (ej. 1000 mic)." }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Modos de operación y márgenes de desperdicio del rollo de film.",
      fields: [
        field({ key: "modosOperacionSoportados", label: "Modos soportados", scope: "maquina", kind: "multiselect", required: true, options: modoLaminadoOptions, description: "Una cara siempre + dos caras (1 o 2 pasadas según máquina)." }),
        field({ key: "margenesDesperdicioMm", label: "Márgenes de desperdicio", scope: "maquina", kind: "textarea", required: true, description: "Material reservado como desperdicio al iniciar, terminar o en los laterales." }),
        field({ key: "margenEntrePliegosMm", label: "Margen entre pliegos", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Separación entre pliegos consecutivos." }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfil operativo (único)",
      description: "Solo 1 perfil 'Estándar': la velocidad/setup no varía mucho entre tipos de film.",
      fields: [
        field({ key: "nombre", label: "Nombre del perfil", scope: "perfil_operativo", kind: "text", required: true, description: "Estándar." }),
        field({ key: "productivityValue", label: "Velocidad", scope: "perfil_operativo", kind: "number", unit: "m_min", required: true, description: "m/min de avance." }),
        field({ key: "setupMin", label: "Setup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Incluye calentamiento." }),
        field({ key: "cleanupMin", label: "Cleanup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de limpieza." }),
      ],
    }),
  ];
}

/** §11 — CORTE_LASER con perfil único "Estándar" (T-4 input manual). */
function buildCorteLaserSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Dimensiones de mesa y espesor máximo.",
      fields: [
        field({ key: "anchoUtil", label: "Ancho de mesa", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Ancho útil de la mesa (ej. 1300mm)." }),
        field({ key: "largoUtil", label: "Largo de mesa", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Largo útil de la mesa (ej. 2500mm)." }),
        field({ key: "espesorMaximo", label: "Altura ajustable de mesa", scope: "maquina", kind: "number", unit: "mm", description: "Altura máx ajustable (ej. 25mm)." }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Tipo de láser y operaciones soportadas.",
      fields: [
        field({ key: "tipoLaser", label: "Tipo de láser", scope: "maquina", kind: "select", required: true, options: tipoLaserOptions, description: "CO2 o Fibra." }),
        field({ key: "potenciaWatts", label: "Potencia", scope: "maquina", kind: "number", unit: "kw", description: "Potencia del láser en watts." }),
        field({ key: "operacionesSoportadas", label: "Operaciones", scope: "maquina", kind: "multiselect", required: true, options: operacionesLaserOptions, description: "Corte y/o grabado." }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfil operativo (único)",
      description: "Tiempo del trabajo NO se estandariza — el comercial lo ingresa al cotizar (T-4 input manual del RIP del láser).",
      fields: [
        field({ key: "nombre", label: "Nombre del perfil", scope: "perfil_operativo", kind: "text", required: true, description: "Estándar." }),
        field({ key: "setupMin", label: "Setup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo típico de carga + calibración." }),
        field({ key: "cleanupMin", label: "Cleanup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de limpieza." }),
      ],
    }),
    section({ id: "desgaste_repuestos", title: "Desgaste y repuestos", description: "Tubo láser por horas de uso.", fields: genericWearFields }),
  ];
}

/** §12 — ROUTER_CNC con perfil único "Estándar" (T-3 productividad nominal). */
function buildRouterCncSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Recorrido X/Y/Z y espesor máximo.",
      fields: [
        field({ key: "anchoUtil", label: "Eje X útil", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Recorrido máx en X." }),
        field({ key: "largoUtil", label: "Eje Y útil", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Recorrido máx en Y." }),
        field({ key: "altoUtil", label: "Eje Z útil", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Espesor máx (= eje Z)." }),
        field({ key: "espesorMaximo", label: "Espesor máximo", scope: "maquina", kind: "number", unit: "mm", description: "Igual a alto útil para CNC." }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Husillo, velocidad y operaciones soportadas.",
      fields: [
        field({ key: "potenciaHusilloKw", label: "Potencia husillo", scope: "maquina", kind: "number", unit: "kw", required: true, description: "Potencia del husillo (ej. 5.5 kW)." }),
        field({ key: "velocidadMaxRPM", label: "Velocidad máxima", scope: "maquina", kind: "number", unit: "rpm", description: "RPM máximas del husillo." }),
        field({ key: "operacionesSoportadas", label: "Operaciones", scope: "maquina", kind: "multiselect", required: true, options: operacionesCncOptions, description: "Corte pasante, fresado, perforado." }),
        field({ key: "tieneAspiracionViruta", label: "Aspiración de viruta", scope: "maquina", kind: "boolean", description: "Si la máquina tiene sistema de aspiración." }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfil operativo (único)",
      description: "Productividad nominal m²/h para casos repetitivos. Casos custom usan T-4 input manual.",
      fields: [
        field({ key: "nombre", label: "Nombre del perfil", scope: "perfil_operativo", kind: "text", required: true, description: "Estándar." }),
        field({ key: "productivityValue", label: "Productividad nominal", scope: "perfil_operativo", kind: "number", unit: "m2_h", required: true, description: "m²/hora para T-3." }),
        field({ key: "setupMin", label: "Setup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Carga material + calibración." }),
        field({ key: "cleanupMin", label: "Cleanup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Aspirar viruta + retirar piezas." }),
      ],
    }),
    section({ id: "desgaste_repuestos", title: "Desgaste y repuestos", description: "Fresa por horas de uso.", fields: genericWearFields }),
  ];
}

/** §13 — ANILLADORA con discriminante tipoAnillo. */
function buildAnilladoraSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Largo máx del anillado y diámetro máx de anillo.",
      fields: [
        field({ key: "anchoUtil", label: "Largo máx anillado", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Largo máx del libro a anillar (ej. 360mm)." }),
        field({ key: "altoUtil", label: "Diámetro máx anillo", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Diámetro máx soportado (ej. 50mm)." }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Tipos de anillo y pasos de orificios soportados.",
      fields: [
        field({ key: "tiposAnilloSoportados", label: "Tipos de anillo", scope: "maquina", kind: "multiselect", required: true, options: tipoAnilloOptions, description: "Espiral plástico y/o wire-O." }),
        field({ key: "pasosOrificiosSoportados", label: "Pasos de orificios", scope: "maquina", kind: "multiselect", options: pasosOrificiosOptions, description: "3:1 y/o 2:1." }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos por tipo de anillo",
      description: "Un perfil por tipo de anillo (espiral plástico vs wire-O).",
      fields: [
        field({ key: "nombre", label: "Nombre del perfil", scope: "perfil_operativo", kind: "text", required: true, description: "Ej. Espiral plástico." }),
        field({ key: "productivityValue", label: "Productividad", scope: "perfil_operativo", kind: "number", unit: "piezas_h", required: true, description: "Hojas por hora (ej. 1200)." }),
        field({ key: "setupMin", label: "Setup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de calibración del paso de orificios." }),
        field({ key: "cleanupMin", label: "Cleanup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Tiempo de limpieza." }),
        field({ key: "tipoAnillo", label: "Tipo de anillo", scope: "perfil_operativo", kind: "select", required: true, options: tipoAnilloOptions, description: "Espiral plástico o wire-O." }),
        field({ key: "diametrosSoportadosMm", label: "Diámetros soportados", scope: "perfil_operativo", kind: "multiselect", description: "JSON: array de mm. Ej. [6, 10, 15, 20, 30, 50]." }),
      ],
    }),
  ];
}

/** §15 — SOLDADORA (pendiente, sin schema detallado). */
function buildSoldadoraSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Volumen útil de trabajo.",
      fields: [
        field({ key: "anchoUtil", label: "Ancho útil", scope: "maquina", kind: "number", unit: "mm", description: "Espacio de trabajo." }),
        field({ key: "largoUtil", label: "Largo útil", scope: "maquina", kind: "number", unit: "mm", description: "Espacio de trabajo." }),
        field({ key: "altoUtil", label: "Alto útil", scope: "maquina", kind: "number", unit: "mm", description: "Espacio de trabajo." }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Personalizar perfiles por tipo de soldadura (MIG, TIG, electrodo) y material.",
      fields: [
        field({ key: "nombre", label: "Nombre del perfil", scope: "perfil_operativo", kind: "text", required: true, description: "Ej. MIG acero estándar." }),
        field({ key: "productivityValue", label: "Productividad", scope: "perfil_operativo", kind: "number", description: "cm/min lineales típicamente (T-2)." }),
        field({ key: "setupMin", label: "Setup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Preparación inicial." }),
        field({ key: "cleanupMin", label: "Cleanup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Limpieza." }),
      ],
    }),
    section({ id: "consumibles", title: "Consumibles", description: "Electrodos, gas (argón, CO2).", fields: genericConsumableFields }),
  ];
}

/** §15 — CABINA_PINTURA (pendiente). */
function buildCabinaPinturaSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Volumen interior de la cabina.",
      fields: [
        field({ key: "anchoUtil", label: "Ancho útil", scope: "maquina", kind: "number", unit: "mm", description: "Ancho interior." }),
        field({ key: "largoUtil", label: "Largo útil", scope: "maquina", kind: "number", unit: "mm", description: "Largo interior." }),
        field({ key: "altoUtil", label: "Alto útil", scope: "maquina", kind: "number", unit: "mm", description: "Alto interior." }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Por tipo de pintura (laca, esmalte) y curado (aire, horno).",
      fields: [
        field({ key: "nombre", label: "Nombre del perfil", scope: "perfil_operativo", kind: "text", required: true, description: "Ej. Laca poliuretánica." }),
        field({ key: "productivityValue", label: "Productividad", scope: "perfil_operativo", kind: "number", unit: "m2_h", description: "m²/hora aproximado." }),
        field({ key: "setupMin", label: "Setup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Preparación." }),
        field({ key: "cleanupMin", label: "Cleanup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Limpieza de equipo." }),
      ],
    }),
    section({ id: "consumibles", title: "Consumibles", description: "Pintura, laca, solvente, primer.", fields: genericConsumableFields }),
  ];
}

/** Plantilla provisional MESA_DE_CORTE — postergada (doc §15). */
function buildMesaCorteSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Dimensiones de mesa y espesor máximo.",
      fields: [
        field({ key: "anchoUtil", label: "Ancho mesa", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Ancho útil de mesa." }),
        field({ key: "largoUtil", label: "Largo mesa", scope: "maquina", kind: "number", unit: "mm", required: true, description: "Largo útil de mesa." }),
        field({ key: "espesorMaximo", label: "Espesor máximo", scope: "maquina", kind: "number", unit: "mm", description: "Espesor máx del material." }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Perfiles por herramienta y material.",
      fields: [
        field({ key: "nombre", label: "Nombre del perfil", scope: "perfil_operativo", kind: "text", required: true, description: "Ej. Cuchilla cartón." }),
        field({ key: "productivityValue", label: "Productividad", scope: "perfil_operativo", kind: "number", unit: "m2_h", description: "m²/hora." }),
        field({ key: "setupMin", label: "Setup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Preparación." }),
        field({ key: "cleanupMin", label: "Cleanup", scope: "perfil_operativo", kind: "number", unit: "min", description: "Limpieza." }),
      ],
    }),
    section({ id: "desgaste_repuestos", title: "Desgaste y repuestos", description: "Cuchillas y filtros.", fields: genericWearFields }),
  ];
}

// ─── Catálogo final ────────────────────────────────────────────────

export const maquinariaTemplates: MaquinariaTemplateDefinition[] = [
  template({
    id: "impresora_laser",
    label: "Impresora láser",
    family: "impresion_digital",
    description: "Impresora digital láser por tóner. Imprime sobre pliegos de papel/cartulina.",
    geometry: "pliego",
    defaultProductionUnit: "ppm",
    allowedProfileTypes: ["impresion"],
    visibleSections: commonTemplateSections,
    sections: buildLaserSections(),
    help: {
      summary: "Plantilla unificada para impresoras láser (Ricoh, Konica, Xerox). Productividad medida en pliegos por minuto (PPM).",
      tips: [
        "Cargá márgenes no imprimibles para que el motor calcule área útil correcta.",
        "Creá perfiles separados por simple/doble faz y rangos de gramaje.",
      ],
      examples: ["Ricoh PRO C5100s para tarjetas, talonarios, folletería"],
    },
  }),
  template({
    id: "impresora_gran_formato_por_area",
    label: "Impresora gran formato por área",
    family: "impresion_gran_formato",
    description: "Impresora unificada para LATEX, SOLVENTE, UV, SUBLIMACION, DTF (rollo o mesa). Productividad m²/h.",
    geometry: "rollo",
    defaultProductionUnit: "m2_h",
    allowedProfileTypes: ["impresion"],
    visibleSections: commonTemplateSections,
    sections: buildGranFormatoSections(),
    help: {
      summary: "Una sola plantilla unifica las 7 viejas (LATEX, UV, DTF, etc.) usando discriminantes tecnologia + geometria.",
      tips: [
        "Si geometria=ROLLO, completá anchoMaxRolloMm.",
        "Si geometria=MESA_EXTENSORA, completá anchoMesaMm/largoMesaMm.",
        "Las DTF necesitan un paso siguiente de Aplicación de transfer (otra máquina, plancha térmica).",
      ],
      examples: [
        "Roland VG3-540 → tecnologia=LATEX + geometria=ROLLO",
        "Mimaki UJF-7151 → tecnologia=UV + geometria=MESA_EXTENSORA",
      ],
    },
  }),
  template({
    id: "guillotina",
    label: "Guillotina",
    family: "terminacion",
    description: "Corte en pila con cuchilla horizontal. Fórmula no lineal (tandas × cortes/tanda).",
    geometry: "pliego",
    defaultProductionUnit: "cortes_min",
    allowedProductionUnits: ["cortes_min", "ciclo"],
    allowedProfileTypes: ["corte"],
    visibleSections: commonTemplateSections,
    sections: buildGuillotinaSections(),
    help: {
      summary: "Productividad NULL en perfiles — la guillotina usa fórmula tandas × cortes/tanda.",
      tips: [
        "tiempoPorCorteSeg es constante en la máquina.",
        "Creá un perfil por rango de gramaje. Cada uno declara pliegosMaxPorTanda.",
      ],
      examples: ["Polar 92 ED para corte de pliegos impresos"],
    },
  }),
  template({
    id: "plotter_de_corte",
    label: "Plotter de corte",
    family: "corte_mecanizado",
    description: "Cuchilla móvil que corta vinilos en rollo. Soporta corte completo o kiss-cut.",
    geometry: "rollo",
    defaultProductionUnit: "m2_h",
    allowedProfileTypes: ["corte"],
    visibleSections: commonTemplateSections,
    sections: buildPlotterCorteSections(),
    help: {
      summary: "Perfiles por tipoCorte + modoOperacion. El factor de complejidad ajusta la productividad m²/hora.",
      tips: [
        "Simple usa 36 m²/h, Intermedio 15 m²/h y Complejo 6 m²/h.",
        "Para multi-rollo, declarar feedReloadMin > 0.",
      ],
      examples: ["Skycut C24 para vinilo de rotulación"],
    },
  }),
  template({
    id: "plotter_cad",
    label: "Plotter CAD",
    family: "impresion_gran_formato",
    description: "Plotter inkjet técnico para planos, mapas, fotos sobre rollo.",
    geometry: "rollo",
    defaultProductionUnit: "m2_h",
    allowedProfileTypes: ["impresion"],
    visibleSections: commonTemplateSections,
    sections: buildPlotterCadSections(),
    help: {
      summary: "Perfiles por tipoTrabajo (CAD vs FOTO) + calidad (DRAFT/NORMAL/ALTA). Cambian abismalmente velocidad y tinta.",
      tips: ["Declará el consumo de tinta en ml/m² por perfil — varía mucho entre CAD y foto."],
      examples: ["HP DesignJet T1700, Canon imagePROGRAF"],
    },
  }),
  template({
    id: "laminadora_bopp_rollo",
    label: "Laminadora BOPP rollo",
    family: "terminacion",
    description: "Aplica film transparente (BOPP brillo, mate, UV) sobre pliegos.",
    geometry: "rollo",
    defaultProductionUnit: "m_min",
    allowedProfileTypes: ["laminado"],
    visibleSections: commonTemplateSections,
    sections: buildLaminadoraBoppSections(),
    help: {
      summary: "Perfil único 'Estándar'. Velocidad medida en m/min.",
      tips: [
        "Declarar modosOperacionSoportados según las capacidades reales (1 o 2 pasadas para doble cara).",
        "Los márgenes de desperdicio impactan el cálculo de consumo de film.",
      ],
      examples: ["GMP Excelam-II"],
    },
  }),
  template({
    id: "corte_laser",
    label: "Corte láser",
    family: "corte_mecanizado",
    description: "Láser CO2 o Fibra para corte y grabado de materiales rígidos.",
    geometry: "plano",
    defaultProductionUnit: "hora",
    allowedProfileTypes: ["corte", "grabado"],
    visibleSections: commonTemplateSections,
    sections: buildCorteLaserSections(),
    help: {
      summary: "El tiempo del trabajo NO se estandariza — el comercial lo ingresa al cotizar (T-4 input manual del RIP).",
      tips: ["Una misma máquina hace corte y grabado según potencia/velocidad usada."],
      examples: ["Bodor BCL1309X, Trotec Speedy"],
    },
  }),
  template({
    id: "router_cnc",
    label: "Router CNC",
    family: "corte_mecanizado",
    description: "Control Numérico Computarizado para corte/fresado/perforado de materiales rígidos.",
    geometry: "volumen",
    defaultProductionUnit: "m2_h",
    allowedProfileTypes: ["mecanizado"],
    visibleSections: commonTemplateSections,
    sections: buildRouterCncSections(),
    help: {
      summary: "Productividad nominal m²/h para casos repetitivos (T-3). Casos custom usan T-4 input manual del CAM.",
      tips: ["Declarar operacionesSoportadas según las herramientas disponibles."],
      examples: ["Felder F500 CNC, ShopBot, AXYZ"],
    },
  }),
  template({
    id: "anilladora",
    label: "Anilladora",
    family: "terminacion",
    description: "Encuadernación con espiral plástico o wire-O.",
    geometry: "pliego",
    defaultProductionUnit: "hora",
    allowedProfileTypes: ["fabricacion"],
    visibleSections: commonTemplateSections,
    sections: buildAnilladoraSections(),
    help: {
      summary: "El motor elige el diámetro de espiral según hojas/libro (criterio MENOR_CAPACIDAD_QUE_CUMPLA).",
      tips: ["Cargá variantes de anillo con su capacidadMaxHojas en el catálogo de materia prima."],
      examples: ["Renz Combi-S, GBC, Rilecart"],
    },
  }),
  template({
    id: "soldadora",
    label: "Soldadora",
    family: "terminacion",
    description: "Equipo de soldadura para herrería y cartelería estructural.",
    geometry: "volumen",
    defaultProductionUnit: "hora",
    allowedProfileTypes: ["fabricacion"],
    visibleSections: commonTemplateSections,
    sections: buildSoldadoraSections(),
    help: {
      summary: "Plantilla pendiente de modelado detallado (doc §15). Personalizá perfiles por tipo (MIG/TIG/electrodo) y material.",
      tips: ["Productividad típica T-2 (cm/min lineales)."],
      examples: ["Soldadoras MIG/TIG para luminosos y carteles estructurales"],
    },
  }),
  template({
    id: "cabina_pintura",
    label: "Cabina de pintura",
    family: "terminacion",
    description: "Cabina presurizada para aplicación de pintura sobre rígidos.",
    geometry: "volumen",
    defaultProductionUnit: "m2_h",
    allowedProfileTypes: ["fabricacion"],
    visibleSections: commonTemplateSections,
    sections: buildCabinaPinturaSections(),
    help: {
      summary: "Plantilla pendiente de modelado detallado (doc §15). Personalizá perfiles según pintura y curado.",
      tips: ["Definí consumibles de pintura, laca, primer y solvente por perfil."],
      examples: ["Cabina con horno para letras corpóreas"],
    },
  }),
  template({
    id: "mesa_de_corte",
    label: "Mesa de corte",
    family: "corte_mecanizado",
    description: "Mesa digital para corte con herramientas intercambiables (cuchilla, fresa).",
    geometry: "plano",
    defaultProductionUnit: "m2",
    allowedProfileTypes: ["corte"],
    visibleSections: commonTemplateSections,
    sections: buildMesaCorteSections(),
    help: {
      summary: "Plantilla provisional (doc §15: postergada — evaluar si CORTE_LASER + PLOTTER cubren los casos).",
      tips: ["Configurá perfiles por herramienta y material."],
      examples: ["Mesa Zünd, Esko Kongsberg"],
    },
  }),
];

export const plantillaMaquinariaItems = maquinariaTemplates
  .map((templateItem) => ({ label: templateItem.label, value: templateItem.id }))
  .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

export function getMaquinariaTemplate(templateId: PlantillaMaquinaria) {
  return maquinariaTemplates.find((templateItem) => templateItem.id === templateId) ?? null;
}

export function getPlantillaMaquinariaLabel(templateId: PlantillaMaquinaria) {
  return getMaquinariaTemplate(templateId)?.label ?? templateId;
}
