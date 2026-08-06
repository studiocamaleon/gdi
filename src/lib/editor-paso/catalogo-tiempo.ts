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
    description:
      "Usa cantidad, ancho y alto cargados por el comercial (con las demasías que hayan agregado pasos previos).",
  },
  {
    value: "piezas_visibles",
    label: "Medida visible terminada",
    description:
      "Usa la medida final que ve el cliente, sin demasías (la chapa trasera se corta al marco, no a la lona agrandada).",
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
    label: "Sin agrupado por talonario",
    description:
      "El paso calcula pliegos de forma estándar. Es la opción normal — incluso en productos de talonarios, si no hace falta apilar los sueltos de forma especial.",
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
    description: "Metros cuadrados de las piezas del pedido, por hora.",
  },
  {
    value: "ml_h",
    label: "ml/h",
    description:
      "Metros lineales por hora (los cotizados o el perímetro de las piezas).",
  },
];

/**
 * Opciones del selector de unidad del ritmo, con la primera opción NOMBRADA
 * cuando el sistema sabe qué cuenta el paso (T3b): "Lo que cuenta el paso
 * (ml de perfil)" le gana a un genérico "Unidades o pliegos/h" que obliga a
 * adivinar.
 */
export function t2ProductivityUnitOptions(unidadCantidad?: string | null) {
  if (!unidadCantidad) return T2_PRODUCTIVITY_UNIT_OPTIONS;
  return T2_PRODUCTIVITY_UNIT_OPTIONS.map((option) =>
    option.value === "unidades_h"
      ? {
          ...option,
          label: `Lo que cuenta el paso (${unidadCantidad})`,
          description: `La cantidad del paso son ${unidadCantidad}: el ritmo se mide ahí.`,
        }
      : option,
  );
}

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
  unidades_h: "unidades",
  m2_h: "m²",
  ml_h: "ml",
};

/**
 * Alias históricos de la unidad del ritmo: hay pasos guardados con
 * `productivityUnit: "piezas_h"` (el motor solo usa el VALOR, la unidad es
 * informativa) — sin normalizar, el selector mostraba "Valor no disponible"
 * (H7 del relevamiento del editor).
 */
export function normalizeT2ProductivityUnit(raw: unknown): string {
  if (raw === "piezas_h" || raw === "pliegos_h") return "unidades_h";
  return typeof raw === "string" && raw in T2_PRODUCTIVITY_UNIT_SUFFIX
    ? raw
    : "unidades_h";
}

/**
 * `unidadCantidad`: el NOMBRE de lo que el paso cuenta cuando se conoce —
 * declarado por la familia (derivador: "ml de perfil", "módulos") o por la
 * config (herencia: "puntos soldadura"). "6 unid./h" no le dice nada al
 * modelador; "6 puntos soldadura/h" sí (H1 del relevamiento).
 */
export function getT2ProductivityUnitSuffix(
  unit: string,
  quantitySource: string,
  unidadCantidad?: string | null,
) {
  if (unit === "ml_h" && quantitySource === "perimetro_piezas_m") {
    return "m perímetro/h";
  }
  if (unit === "unidades_h") {
    if (quantitySource === "cantidad_montaje") return "piezas montadas/h";
    if (
      (quantitySource === "cantidad" ||
        quantitySource.startsWith("derivada:")) &&
      unidadCantidad
    )
      return `${unidadCantidad}/h`;
  }
  return (
    T2_PRODUCTIVITY_UNIT_SUFFIX[unit] ?? T2_PRODUCTIVITY_UNIT_SUFFIX.unidades_h
  );
}

export function getT2BatchUnitSuffix(
  unit: string,
  quantitySource: string,
  unidadCantidad?: string | null,
) {
  if (unit === "ml_h" && quantitySource === "perimetro_piezas_m") {
    return "m perímetro";
  }
  if (unit === "unidades_h") {
    if (quantitySource === "cantidad_montaje") return "piezas a montar";
    if (
      (quantitySource === "cantidad" ||
        quantitySource.startsWith("derivada:")) &&
      unidadCantidad
    )
      return unidadCantidad;
  }
  return T2_BATCH_UNIT_SUFFIX[unit] ?? T2_BATCH_UNIT_SUFFIX.unidades_h;
}

/** [Tanda C] Los defaults del ritmo los DECLARA la ficha (`ritmoDefault`);
 *  antes eran tres funciones con nombres de familia cableados. */
export interface FamiliaParaDefaults {
  mecanismoCantidadDefault?: string | null;
  ritmoDefault?: {
    unidad?: string;
    modoCalculo?: string;
    fuenteCantidad?: string;
  } | null;
}

export function getDefaultT2ProductivityUnit(
  familia?: FamiliaParaDefaults | null,
) {
  return familia?.ritmoDefault?.unidad ?? "unidades_h";
}

export function getDefaultT2TimeCalculationMode(
  familia?: FamiliaParaDefaults | null,
) {
  return familia?.ritmoDefault?.modoCalculo ?? "productivity";
}

export function getDefaultT2QuantitySource(
  familia?: FamiliaParaDefaults | null,
  unit?: string,
) {
  const fuente = familia?.ritmoDefault?.fuenteCantidad;
  if (fuente === "cantidad_montaje" && unit === "unidades_h") {
    return "cantidad_montaje";
  }
  if (unit === "unidades_h") return "cantidad";
  if (unit === "m2_h") return "area_piezas_m2";
  if (unit === "ml_h") return "metros_lineales";
  if (fuente) return fuente;
  return "cantidad";
}

export function getDefaultMecanismoCantidad(
  familia: FamiliaParaDefaults | null | undefined,
  mecanismosSoportados: string[] = [],
) {
  // [Tanda C] La ficha declara con qué mecanismo arranca el paso.
  return familia?.mecanismoCantidadDefault ?? mecanismosSoportados[0] ?? null;
}

/** Familia mínima que estas opciones necesitan (derivador con magnitudes). */
export interface FamiliaParaMagnitudes {
  derivador?: {
    magnitudesTiempo?: Array<{ magnitud: string; etiqueta: string }>;
  } | null;
}

/** Etiqueta humana de una fuente `derivada:<magnitud>` (o null si no lo es). */
export function etiquetaFuenteDerivada(
  familia: FamiliaParaMagnitudes | undefined,
  source: string,
): string | null {
  if (!source.startsWith("derivada:")) return null;
  const magnitud = source.slice("derivada:".length);
  return (
    familia?.derivador?.magnitudesTiempo?.find((m) => m.magnitud === magnitud)
      ?.etiqueta ?? magnitud
  );
}

/** Opciones `derivada:<magnitud>` que la familia ofrece como driver del
 *  tiempo ("el corte se mide por cortes, no por ml" — feedback usuario). */
export function derivedQuantitySourceOptions(
  familia?: FamiliaParaMagnitudes,
) {
  return (familia?.derivador?.magnitudesTiempo ?? []).map((m) => ({
    value: `derivada:${m.magnitud}`,
    label: `${m.etiqueta[0].toUpperCase()}${m.etiqueta.slice(1)} (derivados de la geometría)`,
    description: `Los ${m.etiqueta} que la geometría de este paso deriva: el ritmo se mide sobre ese número.`,
  }));
}

export function getT2QuantitySourceOptions(
  unit: string,
  familia?: FamiliaParaMagnitudes & FamiliaParaDefaults,
) {
  const derivadas = unit === "unidades_h" ? derivedQuantitySourceOptions(familia) : [];
  // [Tanda C] La fuente especial la declara el ritmoDefault de la ficha.
  if (
    familia?.ritmoDefault?.fuenteCantidad === "cantidad_montaje" &&
    unit === "unidades_h"
  ) {
    return [
      ...T2_QUANTITY_SOURCE_OPTIONS.filter((option) =>
        ["cantidad_montaje", "cantidad"].includes(option.value),
      ),
      ...derivadas,
    ];
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
  return [
    ...T2_QUANTITY_SOURCE_OPTIONS.filter(
      (option) => option.value === "cantidad",
    ),
    ...derivadas,
  ];
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
  familia: { codigo?: string; esImpresion?: boolean } | null | undefined,
  cfg: UpsertConfigPasoPayload,
) {
  // [Etapa F3] La familia declara ser de impresión; antes era una lista.
  if (!familia?.codigo || !cfg.maquinaM1Id) return false;
  return familia.esImpresion === true;
}

/** ¿El paso muestra la card de Acomodado/nesting? La familia lo DECLARA
 *  (`nestingConfig` presente ⇔ acomoda piezas) — vale igual para familias de
 *  sistema y de tenant. [Etapa F2: era una lista de códigos hardcodeada]
 *
 *  Excepción de UI que se mantiene: pre_prensa calcula pliegos pero su card
 *  de acomodado siempre se ocultó (regla del detallado congelado). */
export function nestingAplica(
  familia:
    | { codigo?: string; nestingConfig?: unknown }
    | null
    | undefined,
  cfg: UpsertConfigPasoPayload,
) {
  if (!familia?.codigo) return false;
  if (familia.codigo === "pre_prensa") return false;
  if (cfg.mecanismoCantidad === "CALCULADO_POR_PASO") return true;
  return Boolean(familia.nestingConfig);
}

/** "pliegos_impresos" → "Pliegos impresos" — para nombrar en la UI el output
 *  que la ficha declara heredar por default. [Tanda B] */
export function humanizarOutputCanonico(codigo: string): string {
  const texto = codigo.replaceAll("_", " ").trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
