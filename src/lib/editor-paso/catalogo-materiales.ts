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
export const COSTING_STRATEGY_OPTIONS = opcionesDesdeLabels(
  COSTING_STRATEGIES,
  {
    simple: {
      label: "Simple",
      descripcion: "Usa la fórmula de consumo del slot sin costeo especial.",
    },
    "m2-exact": {
      label: "m² exactos",
      descripcion: "Cobra el área útil de las piezas.",
    },
    "consumed-length": {
      label: "Largo consumido",
      descripcion: "Cobra placa completa y último tramo proporcional.",
    },
    "plate-segments": {
      label: "Segmentos de placa",
      descripcion: "Cobra por escalones de ocupación de la placa.",
    },
  },
);

export const SLOT_ROL_OPTIONS: OpcionMaterialCatalogo[] = [
  { value: "COMPONENTE", label: "Componente" },
  { value: "SUSTRATO", label: "Sustrato" },
  { value: "CONSUMIBLE", label: "Consumible" },
  { value: "PACKAGING", label: "Packaging" },
];

export const CANTIDAD_BASE_SLOT_OPTIONS: OpcionMaterialCatalogo[] = [
  { value: "cantidad_pedida", label: "Cantidad pedida" },
  { value: "cantidad_efectiva_paso", label: "Cantidad efectiva del paso" },
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
