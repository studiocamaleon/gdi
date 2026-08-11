/**
 * Catálogo de opciones de Materiales — compartido entre el ESQUEMA
 * declarativo (schema.ts) y el editor detallado congelado (sub-fase C).
 * Vivía a nivel de módulo en config-pasos-editor-view.tsx; una opción,
 * un catálogo.
 */
import {
  modoSeleccionMaterialLabels,
  formulaConsumoLabels,
  criterioMotorAutoLabels,
  type DiccionarioLabels,
} from "../labels-humanos";

/** Shape estructural compatible con HumanSelectOption (value/label/…). */
export interface OpcionMaterialCatalogo {
  value: string;
  label: string;
  description?: string;
}

function opcionesDesdeLabels(
  values: readonly string[],
  dict: DiccionarioLabels,
): OpcionMaterialCatalogo[] {
  return values.map((value) => ({
    value,
    label: dict[value]?.label ?? value,
    description: dict[value]?.descripcion,
  }));
}

export const MODOS_SELECCION = [
  "HARDCODED",
  "COMERCIAL_ELIGE",
  "MOTOR_ELIGE_AUTO",
];
export const CRITERIOS_AUTO = [
  "MENOR_COSTO",
  "MAYOR_APROVECHAMIENTO",
  "MENOR_CAPACIDAD_QUE_CUMPLA",
];
export const FORMULAS = [
  "por_unidad_productiva",
  "por_pieza",
  "por_m2",
  "por_metro_lineal",
  "fijo",
];
export const COSTING_STRATEGIES = [
  "simple",
  "m2-exact",
  "consumed-length",
  "plate-segments",
];

export const SELECCION_MATERIAL_OPTIONS = opcionesDesdeLabels(
  MODOS_SELECCION,
  modoSeleccionMaterialLabels,
);
export const FORMULA_OPTIONS = opcionesDesdeLabels(
  FORMULAS,
  formulaConsumoLabels,
);
export const CRITERIO_AUTO_OPTIONS = opcionesDesdeLabels(
  CRITERIOS_AUTO,
  criterioMotorAutoLabels,
);
/** Unidad del sustrato que se acomoda: una placa rígida o un pliego de
 *  impresión. Cambia sólo el sustantivo de las etiquetas del costeo — decir
 *  "placas" en un paso de impresión por hoja confunde. */
export type UnidadCosteoSustrato = "placa" | "pliego";

// Las cuatro estrategias responden lo mismo: qué se hace con la ÚLTIMA unidad
// que quedó a medio usar (el resto vuelve al estante y sirve para otro
// trabajo). Sólo se ofrecen en placa/pliego: en rollo el consumo del acomodo ya
// ES el costo.
const COSTING_LABELS_POR_UNIDAD: Record<
  UnidadCosteoSustrato,
  Record<string, { label: string; descripcion: string }>
> = {
  // "placa" es el set GENÉRICO: lo usan placas rígidas, chapas y fierros.
  // Los labels hablan de "materia prima" para no atar el modo a un material
  // ("Placas enteras" en un caño de hierro confundía).
  placa: {
    simple: {
      label: "Materia prima completa",
      descripcion:
        "Le imputa al trabajo todas las unidades que tocó (placa, chapa, barra), incluida la última aunque se haya usado a medias.",
    },
    "m2-exact": {
      label: "Sólo lo que ocupan las piezas",
      descripcion:
        "Cobra únicamente el área de las piezas. Ojo: también descuenta los recortes que sí se tiran, así que el margen se ve más alto de lo real.",
    },
    "consumed-length": {
      label: "Largo utilizado de la materia prima",
      descripcion:
        "Unidades llenas enteras + la última proporcional a lo que ocupó. Ej.: 2 placas + 30% de la tercera.",
    },
    "plate-segments": {
      label: "Por tramos de la materia prima",
      descripcion:
        "Unidades llenas enteras + la última redondeada al escalón que corresponda (¼, ½, ¾ o entera).",
    },
  },
  pliego: {
    simple: {
      label: "Pliegos enteros",
      descripcion:
        "Le imputa al trabajo todos los pliegos que tocó, incluido el último aunque se haya usado a medias.",
    },
    "m2-exact": {
      label: "Sólo los m² de las piezas",
      descripcion:
        "Cobra únicamente el área de las piezas. Ojo: también descuenta los recortes que sí se tiran, así que el margen se ve más alto de lo real.",
    },
    "consumed-length": {
      label: "El largo usado del último pliego",
      descripcion:
        "Pliegos llenos enteros + el último proporcional a lo que ocupó. Ej.: 2 pliegos + 30% del tercero.",
    },
    "plate-segments": {
      label: "Por tramos del último pliego",
      descripcion:
        "Pliegos llenos enteros + el último redondeado al escalón que corresponda (¼, ½, ¾ o entero).",
    },
  },
};

/** Opciones de costeo del sustrato con el sustantivo (placa/pliego) que
 *  corresponde. Por defecto "placa" (compat con los usos existentes). */
export function costingStrategyOptions(unidad: UnidadCosteoSustrato = "placa") {
  return opcionesDesdeLabels(COSTING_STRATEGIES, COSTING_LABELS_POR_UNIDAD[unidad]);
}

export const COSTING_STRATEGY_OPTIONS = costingStrategyOptions("placa");

export const SLOT_ROL_OPTIONS: OpcionMaterialCatalogo[] = [
  { value: "COMPONENTE", label: "Componente" },
  { value: "SUSTRATO", label: "Sustrato" },
  { value: "CONSUMIBLE", label: "Consumible" },
  { value: "PACKAGING", label: "Packaging" },
];

export const CANTIDAD_BASE_SLOT_OPTIONS: OpcionMaterialCatalogo[] = [
  { value: "cantidad_pedida", label: "Cantidad pedida" },
  { value: "cantidad_efectiva_paso", label: "Cantidad efectiva del paso" },
  {
    value: "perimetro_piezas_m",
    label: "Metro de perímetro",
    description:
      "El perímetro total de las piezas del trabajo. Una grampa cada 5 cm = factor 20.",
  },
  { value: "pliegos_impresos", label: "Pliegos impresos" },
  {
    value: "talonario_pilas",
    label: "Pilas de talonario",
    description:
      "Pliegos apilados que se abrochan/cortan juntos (requiere modo talonario en pre-prensa). Ej: 1 cartón de contratapa por pila.",
  },
];

// Para slots de insumo declarados por la familia: el default es respetar la
// fórmula del consumo; elegir una base la reemplaza por base × factor.
export const CANTIDAD_BASE_SLOT_OPTIONS_INSUMO: OpcionMaterialCatalogo[] = [
  {
    value: "formula",
    label: "Según fórmula del consumo",
    description:
      'Usa "¿Cómo se calcula el consumo?" tal cual (comportamiento default).',
  },
  ...CANTIDAD_BASE_SLOT_OPTIONS,
];
