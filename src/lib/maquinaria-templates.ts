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

function option(
  value: string,
  label: string,
  description?: string,
): MaquinariaTemplateOption {
  return { value, label, description };
}

function field(definition: MaquinariaTemplateField): MaquinariaTemplateField {
  return definition;
}

function section(
  definition: MaquinariaTemplateSection,
): MaquinariaTemplateSection {
  return definition;
}

function template(
  definition: MaquinariaTemplateDefinition,
): MaquinariaTemplateDefinition {
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

const modoOperacionPlotterOptions = [
  option("ROLLO", "Rollo"),
  option("HOJAS", "Hojas"),
];

const pasadasDobleFazLaminadoOptions = [
  option("1", "1 pasada"),
  option("2", "2 pasadas"),
];

const tecnologia3dOptions = [
  option("FDM", "FDM / filamento"),
  option("RESINA", "Resina (SLA/DLP)"),
];

const material3dOptions = [
  option("PLA", "PLA"),
  option("PETG", "PETG"),
  option("ABS", "ABS"),
  option("TPU", "TPU / flexible"),
  option("NYLON", "Nylon"),
  option("RESINA_STD", "Resina estándar"),
  option("RESINA_TECNICA", "Resina técnica"),
  option("OTRO", "Otro"),
];

// Calidad = altura de capa. Es lo que más mueve el tiempo en 3D.
const calidad3dOptions = [
  option("BORRADOR", "Borrador (capa gruesa)"),
  option("NORMAL", "Normal"),
  option("ALTA", "Alta (capa fina)"),
];

const tipoOperacionCncOptions = [
  option("CORTE", "Corte pasante"),
  option("GRABADO", "Grabado / V-carve"),
  option("SEMICORTE", "Semicorte"),
  option("FRESADO", "Fresado / desbaste"),
];

const materialLaserOptions = [
  option("ACRILICO", "Acrílico"),
  option("MDF", "MDF"),
  option("MADERA", "Madera"),
  option("CARTON_PAPEL", "Cartón / papel"),
  option("CUERO", "Cuero"),
  option("GOMA", "Goma / caucho"),
  option("METAL", "Metal (marcado/fibra)"),
  option("OTRO", "Otro"),
];

const materialCncOptions = [
  option("MDF", "MDF"),
  option("PVC_EXPANDIDO", "PVC expandido"),
  option("ACRILICO", "Acrílico"),
  option("ACM", "ACM / composite"),
  option("FOAM", "Foam / poliestireno"),
  option("MADERA", "Madera maciza"),
  option("ALUMINIO", "Aluminio"),
  option("OTRO", "Otro"),
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
    description:
      "Cantidad consumida por unidad de producción (m², pliego, etc.).",
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
    required: true,
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
        field({
          key: "anchoUtil",
          label: "Ancho útil máximo",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          description: "Ancho máx de pliego (ej. 320mm).",
        }),
        // Sin largoUtil ni gramajeMaxGr (decisión 2026-07-28): el largo del
        // pliego lo pone el material comprado, no la máquina, y el gramaje
        // máximo no lo miraba nadie (la precondición que lo usaba leía otro
        // lugar y nunca disparaba).
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Configuración específica de la impresora láser.",
      fields: [
        field({
          key: "margenesNoImprimiblesMm",
          label: "Márgenes no imprimibles",
          scope: "maquina",
          kind: "textarea",
          required: true,
          description:
            "Distancia que la máquina no puede imprimir en cada borde.",
        }),
        field({
          key: "soporteDobleFaz",
          label: "Soporta doble faz",
          scope: "maquina",
          kind: "boolean",
          description: "Si la máquina puede imprimir ambas caras.",
        }),
        field({
          key: "coloresSoportados",
          label: "Colores soportados",
          scope: "maquina",
          kind: "multiselect",
          options: coloresImpresorLaserOptions,
          description: "Modos de color disponibles.",
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description:
        "Cada perfil describe una combinación cara/color con su productividad.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Ej. Papel grueso doble faz.",
        }),
        field({
          key: "productivityValue",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          unit: "ppm",
          required: true,
          description: "Pliegos por minuto.",
        }),
        field({
          key: "setupMin",
          label: "Setup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de preparación inicial.",
        }),
        field({
          key: "cleanupMin",
          label: "Cleanup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de limpieza al terminar.",
        }),
        field({
          key: "feedReloadMin",
          label: "Recarga papel",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de recarga entre tandas.",
        }),
        // Escalón, igual que en guillotina: el papel más grueso baja la
        // velocidad de la máquina y ese perfil es el que hay que elegir.
        field({
          key: "gramajeMaxGr",
          label: "Gramaje (hasta)",
          scope: "perfil_operativo",
          kind: "number",
          unit: "g_m2",
          required: true,
          description: "Se usa este perfil para papeles de hasta este gramaje.",
        }),
        field({
          key: "caras",
          label: "Caras",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          options: carasOptions,
          description: "Discriminante: simple o doble faz.",
        }),
        field({
          key: "colores",
          label: "Modos de color admitidos",
          scope: "perfil_operativo",
          kind: "multiselect",
          options: coloresImpresorLaserOptions,
          description: "Modos comerciales que puede imprimir este perfil.",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Consumibles",
      description: "Tóner declarado por máquina.",
      fields: genericConsumableFields,
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description:
        "Las piezas que se gastan con el uso: cada click de la máquina cuesta lo que gastó de cada una.",
      fields: genericWearFields,
    }),
  ];
}

function buildDuplicadoraSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Formato máximo de hoja admitido por la duplicadora.",
      fields: [
        field({
          key: "anchoUtil",
          label: "Ancho máximo de hoja",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
        }),
        field({
          key: "largoUtil",
          label: "Largo máximo de hoja",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Sólo los límites que intervienen en el trabajo y el costo.",
      fields: [
        field({
          key: "margenesNoImprimiblesMm",
          label: "Márgenes no imprimibles",
          scope: "maquina",
          kind: "textarea",
          required: true,
          description:
            "El motor los descuenta de la hoja para obtener el área máxima de impresión.",
        }),
        field({
          key: "soporteDobleFaz",
          label: "Soporta doble faz",
          scope: "maquina",
          kind: "boolean",
          description:
            "Doble faz se modela como dos pasadas: duplica tiempo, tinta y máster.",
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description:
        "Un perfil simple faz y otro doble faz; el motor duplica las pasadas automáticamente.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
        }),
        field({
          key: "productivityValue",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          unit: "ppm",
          required: true,
          description: "Hojas terminadas por minuto para este modo.",
        }),
        field({
          key: "setupMin",
          label: "Creación del máster",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description:
            "Tiempo inicial para crear el máster. En doble faz se carga duplicado.",
        }),
        field({
          key: "gramajeMaxGr",
          label: "Gramaje (hasta)",
          scope: "perfil_operativo",
          kind: "number",
          unit: "g_m2",
          required: true,
        }),
        field({
          key: "caras",
          label: "Caras",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          options: carasOptions,
        }),
        field({
          key: "colores",
          label: "Color",
          scope: "perfil_operativo",
          kind: "multiselect",
          options: [option("BN", "Negro (un color)")],
          description: "La plantilla trabaja con un único tambor/color.",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Consumibles",
      description:
        "Tinta negra en ml/m² y máster por original/cara, vinculados al inventario.",
      fields: genericConsumableFields,
    }),
  ];
}

/** §6 — IMPRESORA_GRAN_FORMATO_POR_AREA con discriminantes tecnologia + geometria. */
function buildGranFormatoSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description:
        "Tecnología y geometría definen las variantes de esta plantilla unificada.",
      fields: [
        field({
          key: "tecnologia",
          label: "Tecnología",
          scope: "maquina",
          kind: "select",
          required: true,
          options: tecnologiaGranFormatoOptions,
        }),
        field({
          key: "geometria",
          label: "Geometría",
          scope: "maquina",
          kind: "select",
          required: true,
          options: geometriaGranFormatoOptions,
        }),
        // Sin anchoMinRolloMm ni alturaMaxCabezalMm (decisión 2026-07-28):
        // nadie los leía —ni el motor ni ninguna validación—; eran datos
        // decorativos. Si algún día se valida compatibilidad material↔máquina,
        // se reintroducen junto con esa validación.
        field({
          key: "anchoMaxRolloMm",
          label: "Ancho máximo de rollo",
          scope: "maquina",
          kind: "number",
          unit: "mm",
        }),
        field({
          key: "anchoMesaMm",
          label: "Ancho de mesa",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Se usa cuando la geometría es Mesa extensora.",
        }),
        field({
          key: "largoMesaMm",
          label: "Largo de mesa",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Se usa cuando la geometría es Mesa extensora.",
        }),
        field({
          key: "soportaCorteIntegrado",
          label: "Soporta corte integrado",
          scope: "maquina",
          kind: "boolean",
          description:
            "Permite usar perfiles de corte en esta impresora para trabajos tipo plotter.",
        }),
        field({
          key: "margenesNoImprimiblesMm",
          label: "Márgenes no imprimibles",
          scope: "maquina",
          kind: "textarea",
          required: true,
          description:
            "Distancia que la máquina no puede imprimir en cada borde.",
        }),
        field({
          key: "coloresSoportados",
          label: "Colores soportados",
          scope: "maquina",
          kind: "multiselect",
          options: coloresGranFormatoOptions,
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Cada perfil define productividad y canales de impresión.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Ej. Latex CMYK normal.",
        }),
        field({
          key: "productivityValue",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          unit: "m2_h",
          required: true,
          description: "m²/hora.",
        }),
        field({
          key: "setupMin",
          label: "Setup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de preparación inicial.",
        }),
        field({
          key: "cleanupMin",
          label: "Cleanup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de limpieza al terminar.",
        }),
        field({
          key: "feedReloadMin",
          label: "Recarga rollo",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de recarga de rollo.",
        }),
        field({
          key: "colores",
          label: "Colores",
          scope: "perfil_operativo",
          kind: "select",
          options: coloresGranFormatoOptions,
          description: "Modo de color del perfil.",
        }),
        field({
          key: "factorComplejidad",
          label: "Factor complejidad (JSON)",
          scope: "perfil_operativo",
          kind: "textarea",
          description:
            "Se usa en perfiles de corte integrado. Ej: { SIMPLE: 1.0, INTERMEDIO: 1.5, COMPLEJO: 3.0 }.",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Consumibles",
      description: "Tinta CMYK, blanca, barniz por perfil.",
      fields: genericConsumableFields,
    }),
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
      description:
        "Largo de cuchilla, profundidad de mesa, altura física máx de pila.",
      fields: [
        field({
          key: "anchoUtil",
          label: "Largo de cuchilla",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          description: "Ancho máx de pliego = largo de la cuchilla.",
        }),
        field({
          key: "largoUtil",
          label: "Profundidad de mesa",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Profundidad útil de la mesa.",
        }),
        field({
          key: "altoUtil",
          label: "Altura máx de boca",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          description: "Altura física máx de pila (ej. 165mm).",
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description:
        "Cuanto más grueso el papel, menos pliegos entran en la pila.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Ej. Papel grueso.",
        }),
        field({
          key: "setupMin",
          label: "Setup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de preparación inicial.",
        }),
        field({
          key: "cleanupMin",
          label: "Cleanup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de limpieza.",
        }),
        field({
          key: "feedReloadMin",
          label: "Tiempo entre tandas",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo para preparar la siguiente tanda.",
        }),
        field({
          key: "tiempoPorCorteSeg",
          label: "Tiempo por corte",
          scope: "perfil_operativo",
          kind: "number",
          unit: "seg",
          required: true,
          description:
            "Segundos por cada corte individual (ej. 8). Un papel más duro puede tardar más.",
        }),
        // Escalón, no rango: el perfil que gana es el del "hasta" más chico
        // que todavía cubre el papel. Así no quedan huecos ni solapamientos.
        field({
          key: "gramajeMaxGr",
          label: "Gramaje (hasta)",
          scope: "perfil_operativo",
          kind: "number",
          unit: "g_m2",
          required: true,
          description: "Se usa este perfil para papeles de hasta este gramaje.",
        }),
        field({
          key: "pliegosMaxPorTanda",
          label: "Pliegos por tanda",
          scope: "perfil_operativo",
          kind: "number",
          required: true,
          description: "Cuántos pliegos de ese grosor entran en una pila.",
        }),
      ],
    }),
    // Sin desgaste_repuestos: misma decisión que gran formato (2026-07-28),
    // acá tampoco se va a cargar el dato.
  ];
}

/** §8 — PLOTTER_DE_CORTE: un perfil por nivel de complejidad. El formato
 *  rollo/hoja lo dice el material cargado, no el perfil. */
function buildPlotterCorteSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Ancho de corte y espesor máximo.",
      fields: [
        field({
          key: "anchoUtil",
          label: "Ancho útil",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          description: "Ancho de corte de la boca (ej. 600mm).",
        }),
        field({
          key: "espesorMaximo",
          label: "Espesor máximo",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Vinilo, films delgados (ej. 1mm).",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Modos de carga soportados.",
      fields: [
        // Sin anchoMaxRolloMm (decisión 2026-08-15): duplicaba "Ancho útil"
        // (anchoUtil, Capacidades físicas), que es el campo canónico y requerido
        // que lee el nesting. Mismo criterio que PLOTTER_CAD.
        field({
          key: "modosOperacionSoportados",
          label: "Modos soportados",
          scope: "maquina",
          kind: "multiselect",
          required: true,
          options: modoOperacionPlotterOptions,
          description: "Rollo y/o hojas.",
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      // Un perfil por nivel de complejidad de corte (fácil / complejo): el ritmo
      // m²/h baja cuanto más intrincado es el corte. El modelador fija uno por
      // defecto en la ruta; el comercial lo elige al cotizar. [Holdprint: mismo
      // modelo — "corte simple 8 · corte complejo 4" m²/h.]
      description:
        "Un perfil por nivel de complejidad (el ritmo m²/h baja cuanto más complejo es el corte).",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Ej. Corte fácil, Corte complejo.",
        }),
        field({
          key: "productivityValue",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          unit: "m2_h",
          required: true,
          description: "m²/hora de este nivel (ref: fácil ~8, complejo ~4).",
        }),
        field({
          key: "setupMin",
          label: "Setup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de carga de rollo y calibración.",
        }),
        field({
          key: "cleanupMin",
          label: "Cleanup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de limpieza.",
        }),
        // Sin `modoOperacion` (2026-08-15): rollo vs hoja lo dice el MATERIAL
        // cargado (su subfamilia), no una bandera del perfil. La capacidad
        // física sigue en `modosOperacionSoportados` a nivel máquina.
      ],
    }),
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
        field({
          key: "anchoUtil",
          label: "Ancho útil máximo",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          description: "Ancho máx de rollo.",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Márgenes y colores soportados.",
      fields: [
        // Sin anchoMaxRolloMm (decisión 2026-07-31): duplicaba "Ancho útil
        // máximo" (anchoUtil, Capacidades físicas), que es el campo requerido y
        // canónico del rollo. El motor ya prefiere anchoUtil. Sin anchoMinRolloMm
        // desde 2026-07-28 (nadie lo leía), mismo caso que gran formato.
        field({
          key: "margenesNoImprimiblesMm",
          label: "Márgenes no imprimibles",
          scope: "maquina",
          kind: "textarea",
          required: true,
          description:
            "Distancia que la máquina no puede imprimir en cada borde.",
        }),
        field({
          key: "coloresSoportados",
          label: "Colores soportados",
          scope: "maquina",
          kind: "multiselect",
          options: [option("CMYK", "CMYK")],
          description: "Solo CMYK típicamente.",
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description:
        "Por tipo de trabajo + calidad. Cambian abismalmente velocidad y consumo de tinta.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Ej. CAD - Borrador, Foto - Alta.",
        }),
        field({
          key: "productivityValue",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          unit: "m2_h",
          required: true,
          description: "m²/hora del perfil.",
        }),
        field({
          key: "setupMin",
          label: "Setup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de calibración.",
        }),
        field({
          key: "cleanupMin",
          label: "Cleanup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de limpieza.",
        }),
        field({
          key: "tipoTrabajo",
          label: "Tipo de trabajo",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          options: tipoTrabajoCadOptions,
          description:
            "CAD (rápido, baja densidad) o FOTO (lento, alta densidad).",
        }),
        field({
          key: "calidad",
          label: "Calidad",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          options: calidadCadOptions,
          description: "Borrador, normal o alta.",
        }),
        field({
          key: "colores",
          label: "Modos de color admitidos",
          scope: "perfil_operativo",
          kind: "multiselect",
          options: coloresImpresorLaserOptions,
          description:
            "Modos comerciales que puede imprimir este perfil (B/N para planos, CMYK para color).",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Tintas",
      description:
        "Consumo en ml/m² y material vinculado para cada canal de tinta del perfil.",
      fields: genericConsumableFields,
    }),
    section({
      id: "desgaste_repuestos",
      title: "Cabezal de impresión",
      description:
        "Prorratea el reemplazo del cabezal según los mililitros de tinta que procesa.",
      fields: genericWearFields,
    }),
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
        field({
          key: "anchoUtil",
          label: "Ancho útil máximo",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          description: "Ancho máx de pliego.",
        }),
        field({
          key: "espesorMaximo",
          label: "Espesor máximo",
          scope: "maquina",
          kind: "number",
          unit: "micrones",
          description:
            "Espesor máximo admitido, declarado en micrones (ej. 1000 mic).",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parámetros técnicos",
      description: "Márgenes de desperdicio del rollo de film.",
      fields: [
        field({
          key: "margenesDesperdicioMm",
          label: "Márgenes de desperdicio",
          scope: "maquina",
          kind: "textarea",
          required: true,
          description:
            "Material reservado como desperdicio al iniciar, terminar o en los laterales.",
        }),
        field({
          key: "margenEntrePliegosMm",
          label: "Margen entre pliegos",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          description: "Separación entre pliegos consecutivos.",
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfil operativo (único)",
      description:
        "Solo 1 perfil 'Estándar': la velocidad/setup no varía mucho entre tipos de film.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Estándar.",
        }),
        field({
          key: "productivityValue",
          label: "Velocidad",
          scope: "perfil_operativo",
          kind: "number",
          unit: "m_min",
          required: true,
          description: "m/min de avance.",
        }),
        field({
          key: "pasadasDobleFaz",
          label: "Doble faz",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          options: pasadasDobleFazLaminadoOptions,
          description:
            "Cantidad de pasadas necesarias para laminar ambas caras. El film siempre se consume por las dos caras.",
        }),
        field({
          key: "setupMin",
          label: "Setup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Incluye calentamiento.",
        }),
        field({
          key: "cleanupMin",
          label: "Cleanup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de limpieza.",
        }),
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
      description:
        "Dimensiones de mesa, espesor máximo y márgenes no utilizables.",
      fields: [
        field({
          key: "anchoUtil",
          label: "Ancho de mesa",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "1300",
          description: "Ancho útil de la mesa (ej. 1300mm).",
        }),
        field({
          key: "largoUtil",
          label: "Largo de mesa",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "2500",
          description: "Largo útil de la mesa (ej. 2500mm).",
        }),
        field({
          key: "espesorMaximo",
          label: "Altura ajustable de mesa",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Altura máx ajustable (ej. 25mm).",
        }),
        field({
          key: "margenesNoImprimiblesMm",
          label: "Márgenes no utilizables",
          scope: "maquina",
          kind: "textarea",
          description:
            "Borde de la placa que el cabezal no puede usar en cada lado; el nesting descuenta estos márgenes del área útil.",
        }),
      ],
    }),
    // Se quitó "Parámetros técnicos" (tipoLaser/potenciaWatts/
    // operacionesSoportadas): el motor NO los lee — la operación que rutea vive
    // en el tipoOperacion de cada perfil (auto-selección). Mismo criterio que
    // el CNC y la anilladora.
    section({
      id: "perfiles_operativos",
      title: "Perfiles por operación × material × espesor",
      description:
        "Una fila por combinación: la velocidad va en mm/s (como LightBurn). El motor la aplica al recorrido (perímetro) de las piezas. Cortes calados/filigrana usan T-4 (el comercial carga el tiempo real del RIP).",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Ej. Corte MDF 6mm.",
        }),
        field({
          key: "material",
          label: "Materiales",
          scope: "perfil_operativo",
          kind: "multiselect",
          options: materialLaserOptions,
          description:
            "Sustratos rígidos que cubre el perfil. Es obligatorio para Corte y permite elegir automáticamente la velocidad correcta.",
        }),
        field({
          key: "espesorMinMm",
          label: "Espesor mín",
          scope: "perfil_operativo",
          kind: "number",
          unit: "mm",
          description: "Desde qué espesor aplica. Obligatorio para Corte.",
        }),
        field({
          key: "espesorMaxMm",
          label: "Espesor máx",
          scope: "perfil_operativo",
          kind: "number",
          unit: "mm",
          description: "Hasta qué espesor aplica. Obligatorio para Corte.",
        }),
        field({
          key: "productivityValue",
          label: "Velocidad",
          scope: "perfil_operativo",
          kind: "number",
          unit: "mm_s",
          required: true,
          placeholder: "33",
          description:
            "Velocidad de recorrido en mm/s. Referencia CO2: acrílico 3mm ~125, 5mm ~33, 10mm ~8; grabado ~400.",
        }),
        field({
          key: "setupMin",
          label: "Setup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          placeholder: "10",
          description: "Carga + calibración por trabajo.",
        }),
      ],
    }),
  ];
}

/** §12 — ROUTER_CNC con perfil único "Estándar" (T-3 productividad nominal). */
function buildRouterCncSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description: "Recorrido X/Y/Z y márgenes no utilizables.",
      fields: [
        field({
          key: "anchoUtil",
          label: "Eje X útil",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "2800",
          description: "Recorrido máx en X.",
        }),
        field({
          key: "largoUtil",
          label: "Eje Y útil",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "5000",
          description: "Recorrido máx en Y.",
        }),
        field({
          key: "altoUtil",
          label: "Eje Z útil",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "150",
          description: "Espesor máx de material (= recorrido Z).",
        }),
        field({
          key: "margenesNoImprimiblesMm",
          label: "Márgenes no utilizables",
          scope: "maquina",
          kind: "textarea",
          description:
            "Borde de la placa que la fresa no puede usar en cada lado (clamps, sacrificio); el nesting descuenta estos márgenes del área útil.",
        }),
      ],
    }),
    // Se quitó "Parámetros técnicos" (potenciaHusilloKw/velocidadMaxRPM/
    // operacionesSoportadas/tieneAspiracionViruta): el motor NO los lee — la
    // operación que rutea vive en el tipoOperacion de cada perfil (auto-selección),
    // no en la máquina. Mismo criterio que la anilladora.
    section({
      id: "perfiles_operativos",
      title: "Perfiles por operación × material × espesor",
      description:
        "Una fila por combinación: la velocidad va en mm/min (feed rate). El motor la aplica al recorrido (perímetro) de las piezas. Fresado/desbaste o formas caladas usan T-4 (el comercial carga el tiempo real del CAM).",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Ej. Corte MDF 18mm.",
        }),
        field({
          key: "tipoOperacion",
          label: "Operación",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          options: tipoOperacionCncOptions,
          description: "Corte, grabado, semicorte o fresado.",
        }),
        field({
          key: "material",
          label: "Materiales",
          scope: "perfil_operativo",
          kind: "multiselect",
          options: materialCncOptions,
          description:
            "Materiales que cubre este perfil. Un mismo perfil puede valer para varios (ej. corte de MDF y madera maciza al mismo espesor).",
        }),
        field({
          key: "espesorMinMm",
          label: "Espesor mín",
          scope: "perfil_operativo",
          kind: "number",
          unit: "mm",
          description: "Desde qué espesor aplica (0 = sin mínimo).",
        }),
        field({
          key: "espesorMaxMm",
          label: "Espesor máx",
          scope: "perfil_operativo",
          kind: "number",
          unit: "mm",
          description: "Hasta qué espesor aplica.",
        }),
        field({
          key: "productivityValue",
          label: "Velocidad",
          scope: "perfil_operativo",
          kind: "number",
          unit: "mm_min",
          required: true,
          placeholder: "1700",
          description:
            "Feed rate de recorrido en mm/min. Referencia: MDF 3mm ~1700, 9mm ~500, 18mm ~170; grabado ~16000.",
        }),
        field({
          key: "setupMin",
          label: "Setup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          placeholder: "10",
          description: "Carga material + calibración + cambio de fresa.",
        }),
      ],
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description: "Fresa por horas de uso.",
      fields: genericWearFields,
    }),
  ];
}

function buildCorteHiloCalienteSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Área de recorrido",
      description:
        "Límites físicos dentro de los que puede desplazarse el hilo.",
      fields: [
        field({
          key: "anchoUtil",
          label: "Recorrido X",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "1250",
        }),
        field({
          key: "largoUtil",
          label: "Recorrido Y",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "600",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Control y archivo de máquina",
      description:
        "Define cómo se transforma el recorrido de corte en un archivo ejecutable.",
      fields: [
        field({
          key: "postprocesadorRecorrido",
          label: "Postprocesador",
          scope: "maquina",
          kind: "select",
          required: true,
          options: [option("HOTWIRE_TAP_V1", "TAP · Hotwire / GRBL")],
        }),
        field({
          key: "origenMaquina",
          label: "Origen",
          scope: "maquina",
          kind: "select",
          required: true,
          options: [
            option("bottom-left", "Inferior izquierdo"),
            option("bottom-right", "Inferior derecho"),
            option("top-left", "Superior izquierdo"),
            option("top-right", "Superior derecho"),
          ],
        }),
        field({
          key: "estrategiaOrigen",
          label: "Referencia de inicio",
          scope: "maquina",
          kind: "select",
          options: [
            option("geometry-bounds", "Cerca de las piezas"),
            option("plate-corner", "Esquina de la placa"),
          ],
        }),
        field({
          key: "estrategiaNestingVectorial",
          label: "Cuando el cartel completo entra en una placa",
          scope: "maquina",
          kind: "select",
          options: [
            option(
              "preserve-original-if-fits",
              "Conservar la composición original",
              "Mantiene posiciones y orientación para usar el negativo como molde.",
            ),
            option(
              "optimize-material",
              "Optimizar el uso del material",
              "Reacomoda las piezas para ocupar el menor espacio posible.",
            ),
          ],
          description:
            "Si el vector completo no entra en el área útil, el sistema siempre vuelve al nesting optimizado con segmentación.",
        }),
        field({
          key: "tipoUnionVectorial",
          label: "Unión al dividir piezas grandes",
          scope: "maquina",
          kind: "select",
          required: true,
          options: [
            option(
              "cola_milano",
              "Cola de milano",
              "Genera encastres complementarios para facilitar el armado.",
            ),
            option(
              "recta",
              "Corte recto · sin encastres",
              "Divide la pieza con un canto recto para unir con adhesivo y terminación.",
            ),
          ],
          description:
            "Se aplica únicamente cuando una pieza no entra completa en el área útil.",
        }),
        field({
          key: "anchoEncastreMm",
          label: "Ancho máximo de la cola de milano",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "30",
        }),
        field({
          key: "profundidadEncastreMm",
          label: "Profundidad máxima de la cola de milano",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "30",
        }),
        field({
          key: "modoCantidadEncastres",
          label: "Cómo calcular la cantidad",
          scope: "maquina",
          kind: "select",
          required: true,
          options: [
            option(
              "por_distancia",
              "Automática por distancia",
              "Agrega encastres según el largo de cada unión.",
            ),
            option(
              "cantidad_fija",
              "Cantidad fija por unión",
              "Usa siempre la cantidad indicada, aunque cambie el largo.",
            ),
          ],
        }),
        field({
          key: "distanciaMaximaEncastresMm",
          label: "Distancia máxima entre encastres",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "100",
        }),
        field({
          key: "cantidadMinimaEncastres",
          label: "Cantidad mínima por unión",
          scope: "maquina",
          kind: "number",
          required: true,
          placeholder: "1",
        }),
        field({
          key: "cantidadMaximaEncastres",
          label: "Cantidad máxima por unión",
          scope: "maquina",
          kind: "number",
          required: true,
          placeholder: "100",
        }),
        field({
          key: "cantidadFijaEncastres",
          label: "Cantidad de encastres por unión",
          scope: "maquina",
          kind: "number",
          required: true,
          placeholder: "1",
        }),
        field({
          key: "kerfEncastreMm",
          label: "Ancho del hilo",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "0,3",
          description:
            "Se guarda en la unión para trazabilidad y futuras compensaciones específicas del postprocesador.",
        }),
        field({
          key: "entradaMm",
          label: "Entrada al material",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          placeholder: "8",
        }),
        field({
          key: "decimalesTap",
          label: "Decimales del TAP",
          scope: "maquina",
          kind: "number",
          placeholder: "6",
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Velocidades de corte",
      description:
        "Una velocidad en mm/min por material o espesor. La misma velocidad calcula el tiempo y genera la instrucción F del TAP.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          placeholder: "Polyfan estándar",
        }),
        field({
          key: "material",
          label: "Material",
          scope: "perfil_operativo",
          kind: "text",
          placeholder: "Polyfan",
        }),
        field({
          key: "espesorMinMm",
          label: "Espesor mín.",
          scope: "perfil_operativo",
          kind: "number",
          unit: "mm",
        }),
        field({
          key: "espesorMaxMm",
          label: "Espesor máx.",
          scope: "perfil_operativo",
          kind: "number",
          unit: "mm",
        }),
        field({
          key: "productivityValue",
          label: "Velocidad de corte",
          scope: "perfil_operativo",
          kind: "number",
          unit: "mm_min",
          required: true,
          placeholder: "350",
        }),
        field({
          key: "setupMin",
          label: "Preparación",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          placeholder: "5",
        }),
      ],
    }),
  ];
}

/** §13 — ANILLADORA con discriminante tipoAnillo. */
function buildAnilladoraSections(): MaquinariaTemplateSection[] {
  return [
    // Se quitaron "Capacidades físicas" (anchoUtil/altoUtil) y "Parámetros
    // técnicos" (tiposAnilloSoportados/pasosOrificiosSoportados): el motor NO los
    // lee para el anillado. La capacidad (hojas por Ø) y el TIPO de anillo salen
    // de las variantes de la materia prima (el filtro por tipo usa el tipoAnillo
    // del anillo, no el de la máquina). El perfil sólo aporta el TIEMPO.
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos por tipo de anillo",
      description: "Un perfil por tipo de anillo (espiral plástico vs wire-O).",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Ej. Espiral plástico.",
        }),
        field({
          key: "productivityValue",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          unit: "hojas_h",
          required: true,
          description:
            "Hojas perforadas por hora (ej. 1200). Un libro grueso tarda más.",
        }),
        field({
          key: "setupMin",
          label: "Setup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de calibración del paso de orificios.",
        }),
        field({
          key: "cleanupMin",
          label: "Cleanup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo de limpieza.",
        }),
        field({
          key: "tipoAnillo",
          label: "Tipo de anillo",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          options: tipoAnilloOptions,
          description: "Espiral plástico o wire-O.",
        }),
        // La capacidad (hojas por Ø) NO va acá: vive en cada variante del espiral
        // (materia prima), editable por tenant. El motor elige el Ø por capacidad
        // del material (MENOR_CAPACIDAD_QUE_CUMPLA), no por el perfil.
      ],
    }),
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
        field({
          key: "anchoUtil",
          label: "Ancho mesa",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          description: "Ancho útil de mesa.",
        }),
        field({
          key: "largoUtil",
          label: "Largo mesa",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          description: "Largo útil de mesa.",
        }),
        field({
          key: "espesorMaximo",
          label: "Espesor máximo",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Espesor máx del material.",
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Perfiles por herramienta y material.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Ej. Cuchilla cartón.",
        }),
        field({
          key: "productivityValue",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          unit: "m2_h",
          description: "m²/hora.",
        }),
        field({
          key: "setupMin",
          label: "Setup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Preparación.",
        }),
        field({
          key: "cleanupMin",
          label: "Cleanup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Limpieza.",
        }),
      ],
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description: "Cuchillas y filtros.",
      fields: genericWearFields,
    }),
  ];
}

/** PLANCHA_TERMICA — aplicación de transfer textil (planchado sobre prenda).
 *  Perfil "por ciclo": el modelador carga los segundos del ciclo de prensado y
 *  el backend DERIVA la productividad (piezas/hora). */
function buildPlanchaTermicaSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades físicas",
      description:
        "Tamaño de la plancha (informativo; a futuro, cuántas estampas chicas entran por bajada).",
      fields: [
        field({
          key: "anchoUtil",
          label: "Ancho de plancha",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Ancho útil de la plancha.",
        }),
        field({
          key: "largoUtil",
          label: "Alto de plancha",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Alto útil de la plancha.",
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description:
        "Cargá los segundos del ciclo ACTIVO (pre-planchado + planchado + post-planchado): la productividad (piezas/hora) se calcula sola. En pelado en frío no cargues el enfriamiento (se asume que planchás la siguiente prenda mientras una enfría).",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Ej. DTF textil, Sublimación.",
        }),
        field({
          key: "setupMin",
          label: "Setup de máquina",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description:
            "Calentamiento inicial de la plancha (una vez por tanda).",
        }),
        field({
          key: "tiempoPreplanchadoSeg",
          label: "Pre-planchado",
          scope: "perfil_operativo",
          kind: "number",
          unit: "seg",
          description:
            "Prensada previa para quitar humedad/arrugas antes de poner el transfer (ej. 5-10s). 0 si no aplica.",
        }),
        field({
          key: "tiempoPrensadoSeg",
          label: "Planchado",
          scope: "perfil_operativo",
          kind: "number",
          unit: "seg",
          required: true,
          description:
            "Prensado principal, plancha cerrada. Ej. DTF 15s, sublimación 50s.",
        }),
        field({
          key: "tiempoPostplanchadoSeg",
          label: "Post-planchado",
          scope: "perfil_operativo",
          kind: "number",
          unit: "seg",
          description:
            "Curado / replanchado de sellado tras pelar el film (ej. 5-10s). 0 si no aplica.",
        }),
      ],
    }),
  ];
}

/** IMPRESORA_3D — envolvente + perfiles por material × calidad.
 *
 *  El tiempo NO sale de la caja de la pieza (dos piezas del mismo tamaño
 *  consumen muy distinto según relleno y paredes) sino del CAUDAL de material:
 *  el perfil declara g/h y el paso aporta los gramos de la pieza — el dato que
 *  da cualquier slicer. Cuando el taller ya tiene el tiempo exacto del slicer,
 *  el paso lo carga por tiempo manual (T-4) y este perfil no interviene.
 */
function buildImpresora3dSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Volumen de impresión",
      description:
        "La envolvente máxima que entra en la cama. Informativa: acota qué piezas puede hacer esta máquina.",
      fields: [
        field({
          key: "anchoUtil",
          label: "Eje X",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "256",
          description: "Ancho máx de la cama.",
        }),
        field({
          key: "largoUtil",
          label: "Eje Y",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "256",
          description: "Profundidad máx de la cama.",
        }),
        field({
          key: "altoUtil",
          label: "Eje Z",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          required: true,
          placeholder: "256",
          description: "Altura máx de impresión.",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Tecnología",
      description: "Define el consumible y cómo se mide el material.",
      fields: [
        field({
          key: "tecnologia",
          label: "Tecnología",
          scope: "maquina",
          kind: "select",
          required: true,
          options: tecnologia3dOptions,
          description: "FDM consume filamento; resina consume resina líquida.",
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles por material × calidad",
      description:
        "Una fila por combinación. El caudal (g/h) es lo que la máquina deposita por hora con ese material y esa altura de capa; el motor lo aplica a los gramos de la pieza.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Ej. PLA normal 0,2mm.",
        }),
        field({
          key: "material",
          label: "Materiales",
          scope: "perfil_operativo",
          kind: "multiselect",
          options: material3dOptions,
          description: "Materiales que cubre este perfil.",
        }),
        field({
          key: "calidad",
          label: "Calidad",
          scope: "perfil_operativo",
          kind: "select",
          options: calidad3dOptions,
          description:
            "Altura de capa: gruesa imprime más rápido, fina tarda más.",
        }),
        field({
          key: "alturaCapaMm",
          label: "Altura de capa",
          scope: "perfil_operativo",
          kind: "number",
          unit: "mm",
          description: "Referencia del perfil del slicer (ej. 0,2mm).",
        }),
        field({
          key: "productivityValue",
          label: "Caudal de material",
          scope: "perfil_operativo",
          kind: "number",
          unit: "g_h",
          required: true,
          placeholder: "23",
          description:
            "Gramos por hora que deposita la máquina con este perfil. Referencia FDM: ~23 g/h en calidad normal.",
        }),
        field({
          key: "setupMin",
          label: "Setup",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Nivelado, carga de material y preparación de la cama.",
        }),
        field({
          key: "cleanupMin",
          label: "Post-proceso de máquina",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description:
            "Retiro de la pieza y limpieza de la cama. El curado/lavado de resina o el retiro de soportes van como paso aparte.",
        }),
      ],
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description: "Boquilla, cama, film FEP: por horas de uso.",
      fields: genericWearFields,
    }),
  ];
}

// ─── Catálogo final ────────────────────────────────────────────────

export const maquinariaTemplates: MaquinariaTemplateDefinition[] = [
  template({
    id: "impresora_laser",
    label: "Impresora láser",
    family: "impresion_digital",
    description:
      "Impresora digital láser por tóner. Imprime sobre pliegos de papel/cartulina.",
    geometry: "pliego",
    defaultProductionUnit: "ppm",
    allowedProfileTypes: ["impresion"],
    visibleSections: commonTemplateSections,
    sections: buildLaserSections(),
    help: {
      summary:
        "Plantilla unificada para impresoras láser (Ricoh, Konica, Xerox). Productividad medida en pliegos por minuto (PPM).",
      tips: [
        "Cargá márgenes no imprimibles para que el motor calcule área útil correcta.",
        "Creá perfiles separados por simple/doble faz y rangos de gramaje.",
      ],
      examples: ["Ricoh PRO C5100s para tarjetas, talonarios, folletería"],
    },
  }),
  template({
    id: "duplicadora_digital",
    label: "Duplicadora digital",
    family: "impresion_digital",
    description:
      "Duplicadora de un tambor que crea un máster y reproduce tiradas sobre hojas.",
    geometry: "pliego",
    defaultProductionUnit: "ppm",
    allowedProfileTypes: ["impresion"],
    visibleSections: commonTemplateSections,
    sections: buildDuplicadoraSections(),
    help: {
      summary:
        "Costea una tinta en ml/m² y un máster por original y cara. Doble faz equivale a dos pasadas.",
      tips: [
        "Configurá únicamente el color instalado en el tambor.",
        "En doble faz mantené la velocidad por pasada y duplicá sólo la creación de máster; el motor duplica la corrida.",
      ],
      examples: ["Ricoh Priport DX 2430 con tambor negro"],
    },
  }),
  template({
    id: "impresora_gran_formato_por_area",
    label: "Impresora gran formato por área",
    family: "impresion_gran_formato",
    description:
      "Impresora unificada para LATEX, SOLVENTE, UV, SUBLIMACION, DTF (rollo o mesa). Productividad m²/h.",
    geometry: "rollo",
    defaultProductionUnit: "m2_h",
    allowedProfileTypes: ["impresion"],
    visibleSections: commonTemplateSections,
    sections: buildGranFormatoSections(),
    help: {
      summary:
        "Una sola plantilla unifica las 7 viejas (LATEX, UV, DTF, etc.) usando discriminantes tecnologia + geometria.",
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
    description:
      "Corte en pila con cuchilla horizontal. Fórmula no lineal (tandas × cortes/tanda).",
    geometry: "pliego",
    defaultProductionUnit: "cortes_min",
    allowedProductionUnits: ["cortes_min", "ciclo"],
    allowedProfileTypes: ["corte"],
    visibleSections: commonTemplateSections,
    sections: buildGuillotinaSections(),
    help: {
      summary:
        "Productividad NULL en perfiles — la guillotina usa fórmula tandas × cortes/tanda.",
      tips: [
        "El tiempo por corte se declara en cada perfil: un papel más duro puede tardar más.",
        "Creá un perfil por rango de gramaje. Cada uno declara pliegosMaxPorTanda.",
      ],
      examples: ["Polar 92 ED para corte de pliegos impresos"],
    },
  }),
  template({
    id: "plotter_de_corte",
    label: "Plotter de corte",
    family: "corte_mecanizado",
    description:
      "Cuchilla móvil que corta vinilos en rollo. Soporta corte completo o kiss-cut.",
    geometry: "rollo",
    defaultProductionUnit: "m2_h",
    allowedProfileTypes: ["corte"],
    visibleSections: commonTemplateSections,
    sections: buildPlotterCorteSections(),
    help: {
      summary:
        "Un perfil por nivel de complejidad de corte. La productividad m²/h baja cuanto más intrincado es el corte.",
      tips: [
        "Referencia (Holdprint): corte fácil ~8 m²/h, corte complejo ~4 m²/h.",
        "El modelador fija un perfil por defecto en el paso; el comercial lo cambia al cotizar.",
      ],
      examples: ["Skycut C24 para vinilo de rotulación"],
    },
  }),
  template({
    id: "plotter_cad",
    label: "Plotter CAD",
    family: "impresion_gran_formato",
    description:
      "Plotter inkjet técnico para planos, mapas, fotos sobre rollo.",
    geometry: "rollo",
    defaultProductionUnit: "m2_h",
    allowedProfileTypes: ["impresion"],
    visibleSections: commonTemplateSections,
    sections: buildPlotterCadSections(),
    help: {
      summary:
        "Perfiles por tipoTrabajo (CAD vs FOTO) + calidad (DRAFT/NORMAL/ALTA). Cambian abismalmente velocidad y tinta.",
      tips: [
        "Configurá el consumo de cada tinta en ml/m² dentro de cada perfil — varía mucho entre CAD y foto.",
      ],
      examples: ["HP DesignJet T1700, Canon imagePROGRAF"],
    },
  }),
  template({
    id: "laminadora_bopp_rollo",
    label: "Laminadora BOPP rollo",
    family: "terminacion",
    description:
      "Aplica film transparente (BOPP brillo, mate, UV) sobre pliegos.",
    geometry: "rollo",
    defaultProductionUnit: "m_min",
    allowedProfileTypes: ["laminado"],
    visibleSections: commonTemplateSections,
    sections: buildLaminadoraBoppSections(),
    help: {
      summary: "Perfil único 'Estándar'. Velocidad medida en m/min.",
      tips: [
        "Indicá en el perfil si el doble faz se procesa en 1 o 2 pasadas.",
        "Los márgenes de desperdicio impactan el cálculo de consumo de film.",
      ],
      examples: ["GMP Excelam-II"],
    },
  }),
  template({
    id: "corte_laser",
    label: "Corte láser",
    family: "corte_mecanizado",
    description:
      "Láser CO2 o Fibra para corte y grabado de materiales rígidos.",
    geometry: "plano",
    defaultProductionUnit: "mm_s",
    allowedProfileTypes: ["corte", "grabado"],
    visibleSections: commonTemplateSections,
    sections: buildCorteLaserSections(),
    help: {
      summary:
        "Perfiles por operación × material × espesor con velocidad en mm/s (como LightBurn). El motor cotiza por recorrido; cortes calados usan T-4 manual del RIP.",
      tips: [
        "Creá un perfil por material y rango de espesor (ej. Corte MDF 3-6mm).",
        "El grabado raster de relleno conviene cargarlo por T-4 (el perímetro lo subvalúa).",
      ],
      examples: ["Bodor BCL1309X, Trotec Speedy"],
    },
  }),
  template({
    id: "router_cnc",
    label: "Router CNC",
    family: "corte_mecanizado",
    description:
      "Control Numérico Computarizado para corte/fresado/perforado de materiales rígidos.",
    geometry: "volumen",
    defaultProductionUnit: "mm_min",
    allowedProfileTypes: ["mecanizado"],
    visibleSections: commonTemplateSections,
    sections: buildRouterCncSections(),
    help: {
      summary:
        "Perfiles por operación × material × espesor con velocidad en mm/min (feed rate). El motor cotiza por recorrido; fresado/desbaste usa T-4 manual del CAM.",
      tips: [
        "Creá un perfil por material y rango de espesor (ej. Corte MDF 12-18mm).",
        "Declarar operacionesSoportadas según las herramientas disponibles.",
      ],
      examples: ["Felder F500 CNC, ShopBot, AXYZ"],
    },
  }),
  template({
    id: "corte_hilo_caliente",
    label: "Cortadora de hilo caliente",
    family: "corte_mecanizado",
    description:
      "Corte vectorial continuo de Polyfan y espumas mediante archivo TAP.",
    geometry: "plano",
    defaultProductionUnit: "mm_min",
    allowedProfileTypes: ["corte"],
    visibleSections: commonTemplateSections,
    sections: buildCorteHiloCalienteSections(),
    help: {
      summary:
        "El recorrido CORTE enlaza contornos y el postprocesador genera un TAP con la velocidad del perfil.",
      tips: [
        "Cargá la velocidad real en mm/min para que tiempo, costo, simulación y TAP coincidan.",
        "El área X/Y pertenece a la máquina; el margen sin usar pertenece a la placa de material.",
        "Podés conservar la composición del SVG para reutilizar el negativo de la placa como molde de colocación.",
        "Definí si las piezas grandes se unen con cola de milano o con un corte recto; la política queda guardada en cada cotización.",
      ],
      examples: ["Corporearte 1250 × 600 mm"],
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
      summary:
        "El motor elige el diámetro de espiral según hojas/libro (criterio MENOR_CAPACIDAD_QUE_CUMPLA).",
      tips: [
        "Cargá variantes de anillo con su capacidadMaxHojas en el catálogo de materia prima.",
      ],
      examples: ["Renz Combi-S, GBC, Rilecart"],
    },
  }),
  template({
    id: "mesa_de_corte",
    label: "Mesa de corte",
    family: "corte_mecanizado",
    description:
      "Mesa digital para corte con herramientas intercambiables (cuchilla, fresa).",
    geometry: "plano",
    defaultProductionUnit: "m2",
    allowedProfileTypes: ["corte"],
    visibleSections: commonTemplateSections,
    sections: buildMesaCorteSections(),
    help: {
      summary:
        "Plantilla provisional (doc §15: postergada — evaluar si CORTE_LASER + PLOTTER cubren los casos).",
      tips: ["Configurá perfiles por herramienta y material."],
      examples: ["Mesa Zünd, Esko Kongsberg"],
    },
  }),
  template({
    id: "plancha_termica",
    label: "Plancha térmica",
    family: "terminacion",
    description:
      "Prensa de calor para aplicar transfers sobre prendas (DTF textil, sublimación, vinilo textil).",
    geometry: "plano",
    defaultProductionUnit: "piezas_h",
    allowedProfileTypes: ["fabricacion"],
    visibleSections: commonTemplateSections,
    sections: buildPlanchaTermicaSections(),
    help: {
      summary:
        "Plancha térmica textil. La productividad (piezas/hora) se calcula a partir de los segundos del ciclo de prensado.",
      tips: [
        "Creá un perfil por tecnología: DTF, sublimación, vinilo textil.",
        "Cargá el tiempo de prensado (plancha cerrada) y el de manipulación; el sistema deriva las piezas/hora.",
      ],
      examples: [
        "Prensa plana 40×50 para remeras",
        "Prensa para sublimación textil",
      ],
    },
  }),
  template({
    id: "impresora_3d",
    label: "Impresora 3D",
    family: "impresion_digital",
    description: "Fabricación aditiva por filamento (FDM) o resina.",
    geometry: "plano",
    defaultProductionUnit: "g_h",
    allowedProfileTypes: ["fabricacion"],
    visibleSections: commonTemplateSections,
    sections: buildImpresora3dSections(),
    help: {
      summary:
        "El tiempo sale del CAUDAL de material: el perfil declara g/h y el paso aporta los gramos de la pieza (dato del slicer). Cuando ya tenés las horas exactas del slicer, cargalas como tiempo manual y el perfil no interviene.",
      tips: [
        "Creá un perfil por material y calidad (ej. PLA normal 0,2mm), no por tamaño de pieza.",
        "El caudal típico de una FDM ronda 10–25 g/h; medilo con una pieza conocida: gramos ÷ horas reales.",
        "El relleno (%) no va acá: es del paso, porque cambia trabajo a trabajo.",
        "El filamento o la resina se cargan como consumible por gramo, desde la biblioteca de materia prima.",
      ],
      examples: ["Bambu Lab / Prusa (FDM)", "Elegoo / Anycubic (resina)"],
    },
  }),
];

export const plantillaMaquinariaItems = maquinariaTemplates
  .map((templateItem) => ({
    label: templateItem.label,
    value: templateItem.id,
  }))
  .sort((a, b) =>
    a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
  );

export function getMaquinariaTemplate(templateId: PlantillaMaquinaria) {
  return (
    maquinariaTemplates.find(
      (templateItem) => templateItem.id === templateId,
    ) ?? null
  );
}

export function getPlantillaMaquinariaLabel(templateId: PlantillaMaquinaria) {
  return getMaquinariaTemplate(templateId)?.label ?? templateId;
}
