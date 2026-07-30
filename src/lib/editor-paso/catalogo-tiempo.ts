/**
 * Catálogo de opciones de Tiempo y costo — compartido entre el ESQUEMA
 * declarativo (schema.ts) y el editor detallado congelado. Vivía a nivel
 * de módulo en config-pasos-editor-view.tsx; se movió acá en la sub-fase
 * B para que ambas vistas lean LA MISMA fuente (una opción, un catálogo).
 */
import type { UpsertConfigPasoPayload } from "../productos-servicios-api";

export const MONTAJE_SOURCE_OPTIONS = [
  {
    value: "piezas_jobcontext",
    label: "Piezas del producto",
    description: "Usa cantidad, ancho y alto cargados por el comercial.",
  },
  {
    value: "pliegos_impresos",
    label: "Pliegos impresos",
    description:
      "Usa pliegos_impresos y el tamaño de pliego publicado por impresión.",
  },
];

export const TALONARIO_MODE_OPTIONS = [
  {
    value: "off",
    label: "No es talonario",
    description:
      "El paso calcula pliegos de forma estándar, sin agrupar por talonario.",
  },
  {
    value: "aprovechar_pliego",
    label: "Aprovechar papel",
    description:
      "El talonario suelto comparte pliego entre sus propios números: mínimo papel, pero producción debe cortar y acomodar ese bloque a mano.",
  },
  {
    value: "pose_completa",
    label: "Pose completa",
    description:
      "El talonario suelto se imprime con poses vacías: sale apilado listo para abrochar y cortar, a costa de desperdiciar papel en cantidades impares.",
  },
];

export const T2_PRODUCTIVITY_UNIT_OPTIONS = [
  {
    value: "unidades_h",
    label: "Unidades o pliegos/h",
    description:
      "Usa la cantidad del paso: pliegos, piezas, packs u otra unidad contable.",
  },
  {
    value: "m2_h",
    label: "m²/h",
    description: "Metros cuadrados por hora.",
  },
  {
    value: "ml_h",
    label: "ml/h",
    description: "Metros lineales por hora.",
  },
];

export const T2_TIME_CALCULATION_MODE_OPTIONS = [
  {
    value: "productivity",
    label: "Productividad por hora",
    description: "Ejemplo: 120 pliegos por hora.",
  },
  {
    value: "batch_time",
    label: "Tiempo por lote",
    description: "Ejemplo: 2 pliegos cada 1 minuto.",
  },
];

export const TIEMPO_MANUAL_UNIDAD_OPTIONS = [
  {
    value: "min",
    label: "Minutos",
    description: "El comercial carga el tiempo en minutos (típico: láser).",
  },
  {
    value: "h",
    label: "Horas",
    description: "El comercial carga el tiempo en horas (típico: diseño).",
  },
];

const T2_QUANTITY_SOURCE_OPTIONS = [
  {
    value: "cantidad",
    label: "Cantidad efectiva del paso",
    description: "Respeta el mecanismo de cantidad configurado para el paso.",
  },
  {
    value: "cantidad_montaje",
    label: "Piezas/pliegos a montar",
    description:
      "Usa la cantidad definida en Piezas a montar para calcular tiempo.",
  },
  {
    value: "area_piezas_m2",
    label: "Área calculada desde piezas",
    description: "Usa el área real de las medidas cargadas al cotizar.",
  },
  {
    value: "m2_instalados",
    label: "m² instalados manuales",
    description: "Usa el campo m² instalados que carga comercial.",
  },
  {
    value: "metros_lineales",
    label: "Metros lineales cotizados",
    description: "Usa los metros lineales comerciales del producto.",
  },
  {
    value: "perimetro_piezas_m",
    label: "Perímetro total de piezas",
    description: "Suma el perímetro rectangular de todas las piezas.",
  },
];

const T2_PRODUCTIVITY_UNIT_SUFFIX: Record<string, string> = {
  unidades_h: "unid./h",
  m2_h: "m²/h",
  ml_h: "ml/h",
};
const T2_BATCH_UNIT_SUFFIX: Record<string, string> = {
  unidades_h: "unid./pliegos",
  m2_h: "m²",
  ml_h: "ml",
};

export function getT2ProductivityUnitSuffix(
  unit: string,
  quantitySource: string,
) {
  if (unit === "ml_h" && quantitySource === "perimetro_piezas_m") {
    return "m perímetro/h";
  }
  return (
    T2_PRODUCTIVITY_UNIT_SUFFIX[unit] ?? T2_PRODUCTIVITY_UNIT_SUFFIX.unidades_h
  );
}

export function getT2BatchUnitSuffix(unit: string, quantitySource: string) {
  if (unit === "ml_h" && quantitySource === "perimetro_piezas_m") {
    return "m perímetro";
  }
  return T2_BATCH_UNIT_SUFFIX[unit] ?? T2_BATCH_UNIT_SUFFIX.unidades_h;
}

export function getDefaultT2ProductivityUnit(familiaCodigo?: string) {
  return familiaCodigo === "instalacion_in_situ" ? "m2_h" : "unidades_h";
}

export function getDefaultT2TimeCalculationMode(familiaCodigo?: string) {
  return familiaCodigo === "embalaje" ||
    familiaCodigo === "montaje_sobre_sustrato"
    ? "batch_time"
    : "productivity";
}

export function getDefaultT2QuantitySource(
  familiaCodigo?: string,
  unit?: string,
) {
  if (familiaCodigo === "montaje_sobre_sustrato" && unit === "unidades_h") {
    return "cantidad_montaje";
  }
  if (unit === "unidades_h") return "cantidad";
  if (unit === "m2_h") return "area_piezas_m2";
  if (unit === "ml_h") return "metros_lineales";
  if (familiaCodigo === "instalacion_in_situ") return "area_piezas_m2";
  return "cantidad";
}

export function getDefaultMecanismoCantidad(
  familiaCodigo?: string,
  mecanismosSoportados: string[] = [],
) {
  if (familiaCodigo === "impresion_por_hoja")
    return "HEREDAR_DEL_OUTPUT_CANONICO";
  if (familiaCodigo === "corte_manual") return "HEREDAR_DEL_OUTPUT_CANONICO";
  if (familiaCodigo === "montaje_sobre_sustrato") return "CALCULADO_POR_PASO";
  return mecanismosSoportados[0] ?? null;
}

export function getT2QuantitySourceOptions(
  unit: string,
  familiaCodigo?: string,
) {
  if (familiaCodigo === "montaje_sobre_sustrato" && unit === "unidades_h") {
    return T2_QUANTITY_SOURCE_OPTIONS.filter((option) =>
      ["cantidad_montaje", "cantidad"].includes(option.value),
    );
  }
  if (unit === "m2_h") {
    return T2_QUANTITY_SOURCE_OPTIONS.filter((option) =>
      ["area_piezas_m2", "m2_instalados", "cantidad"].includes(option.value),
    );
  }
  if (unit === "ml_h") {
    return T2_QUANTITY_SOURCE_OPTIONS.filter((option) =>
      ["metros_lineales", "perimetro_piezas_m", "cantidad"].includes(
        option.value,
      ),
    );
  }
  return T2_QUANTITY_SOURCE_OPTIONS.filter(
    (option) => option.value === "cantidad",
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Config del "tiempo estimado por el comercial" (tiempo manual). */
export function getTiempoManualConfig(
  params: Record<string, unknown> | null | undefined,
) {
  return asRecord(asRecord(params).tiempoManual);
}

export function isConsumibleMaquinaSlot(slot: {
  tipo?: string;
  codigo?: string;
  slotCodigo?: string;
}) {
  return slot.tipo === "CONSUMIBLE_MAQUINA";
}

export function requiereMecanismoCantidad(
  cfg: UpsertConfigPasoPayload,
  familia:
    | {
        slotsRequeridos: Array<{
          codigo: string;
          requerido: boolean;
          tipo?: string;
        }>;
      }
    | undefined,
) {
  if (!cfg.modoTiempo) return true;
  if (cfg.modoTiempo !== "T-1") return true;

  const tieneMaterialesDeclarados =
    (familia?.slotsRequeridos.filter((slot) => !isConsumibleMaquinaSlot(slot))
      .length ?? 0) > 0 || (cfg.slotsMateriales?.length ?? 0) > 0;
  return tieneMaterialesDeclarados;
}

// ─── Máquina y color (los usa también el esquema de maquina.*) ────────

/** Config de modo de color del producto (paramsPasoJson.modoColorConfig). */
export function getModoColorConfig(
  params: Record<string, unknown> | null | undefined,
) {
  return asRecord(asRecord(params).modoColorConfig);
}

export function modoColorAplica(
  familiaCodigo: string | undefined,
  cfg: UpsertConfigPasoPayload,
) {
  if (!familiaCodigo || !cfg.maquinaM1Id) return false;
  return ["impresion_por_hoja", "impresion_por_area"].includes(familiaCodigo);
}

/** ¿El paso muestra la card de Acomodado/nesting? (misma regla que el
 *  detallado congelado). */
export function nestingAplica(
  familiaCodigo: string | undefined,
  cfg: UpsertConfigPasoPayload,
) {
  if (!familiaCodigo) return false;
  if (familiaCodigo === "pre_prensa") return false;
  if (cfg.mecanismoCantidad === "CALCULADO_POR_PASO") return true;
  return [
    "impresion_por_area",
    "impresion_por_hoja",
    "plotter_corte",
    "laminado",
    "montaje_sobre_sustrato",
  ].includes(familiaCodigo);
}
