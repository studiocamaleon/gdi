/**
 * Catálogo de opciones de Tiempo y costo — compartido entre el ESQUEMA
 * declarativo (schema.ts) y el editor detallado congelado. Vivía a nivel
 * de módulo en config-pasos-editor-view.tsx; se movió acá en la sub-fase
 * B para que ambas vistas lean LA MISMA fuente (una opción, un catálogo).
 */
import type { UpsertConfigPasoPayload } from "../productos-servicios-api";
import { leerEfectoDemasia } from "../efectos-paso";

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
  {
    // El tiempo fijo del paso vivía escondido como un escape al pie del
    // ritmo ("o un tiempo fijo estimado"). Es un modo, no una nota al pie:
    // el motor le da prioridad sobre el ritmo. Se guarda en `horasEstimadas`
    // como siempre; `timeCalculationMode: "tiempo_fijo"` sólo declara la
    // intención (el motor lo trata como "no es por lote", que es correcto).
    value: "tiempo_fijo",
    label: "Tiempo fijo",
    description: "Ejemplo: 1,5 h por orden, sin importar la cantidad.",
  },
];

/** Pregunta ① del árbol de tiempo: ¿de dónde sale el tiempo base?
 *  (docs/tiempo-pasos-analisis-y-plan.md §4). "Máquina" agrupa T-3 (perfil
 *  y primitivas); "taller" agrupa T-1/T-2 (fijo o ritmo propio). */
export const TIEMPO_ORIGEN_OPTIONS = [
  {
    value: "taller",
    label: "Lo definís vos (el taller)",
    description:
      "Un tiempo fijo o un ritmo propio del paso, declarado acá.",
  },
  {
    value: "maquina",
    label: "Lo dice la máquina",
    description:
      "La velocidad sale del perfil operativo de la máquina elegida (o de su plan de trabajo, como el de corte de la guillotina).",
  },
];

/** Pregunta ② del árbol: ¿tiempo dicho o calculado por regla? */
export const TIEMPO_FORMA_OPTIONS = [
  {
    value: "fijo",
    label: "Tiempo fijo",
    description: "Tarda lo mismo sin importar la cantidad. Ej: 2 horas.",
  },
  {
    value: "ritmo",
    label: "Tiempo variable",
    description:
      "Depende de cuánto se produce: definí la regla. Ej: 3 piezas cada 1 min, 40 m² por hora.",
  },
];

/** Capa ⑤ del árbol: el comercial sobre el tiempo base. No es un modo — se
 *  apoya sobre cualquiera (guarda `paramsPasoJson.tiempoManual`). */
export const TIEMPO_COMERCIAL_NIVEL_OPTIONS = [
  {
    value: "no",
    label: "No",
    description: "El tiempo se calcula solo con lo definido acá.",
  },
  {
    value: "puede",
    label: "Sí, puede",
    description:
      "El cotizador sugiere el tiempo base y el comercial lo puede pisar (si no lo toca, vale el base).",
  },
  {
    value: "debe",
    label: "Debe cargarlo",
    description:
      "Sin el tiempo del comercial no se cotiza (típico: minutos de láser según el RIP).",
  },
];

/** Las dos formas de RITMO de la pregunta ③. "Tiempo fijo" ya no es una de
 *  ellas: subió a la pregunta ② (era un modo escondido dentro del ritmo). */
export const T2_RITMO_OPTIONS = T2_TIME_CALCULATION_MODE_OPTIONS.filter(
  (o) => o.value !== "tiempo_fijo",
);

/** Equivalencia honesta del pseudo-batch (F0.5): una tanda de tamaño 1 es un
 *  ritmo disfrazado. Devuelve las unidades/hora equivalentes, o null si la
 *  tanda es genuina (tamaño > 1) o faltan datos. La equivalencia no es
 *  exacta al centavo: la tanda redondea la cantidad hacia arriba. */
export function ritmoEquivalenteDeBatch(
  batchSize: number | null | undefined,
  batchTimeMin: number | null | undefined,
): number | null {
  const size = Number(batchSize ?? NaN);
  const min = Number(batchTimeMin ?? NaN);
  if (!Number.isFinite(size) || !Number.isFinite(min)) return null;
  if (size !== 1 || min <= 0) return null;
  return Math.round((60 / min) * 100) / 100;
}

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
  {
    // [F3 efectos] Sólo se ofrece si el paso EXIGE material extra: son los
    // metros de los lados que ese efecto declara, sobre la medida visible.
    value: "perimetro_lados_efecto",
    label: "Borde que este paso trabaja",
    description:
      "Los metros de los lados donde el paso pide material extra, medidos sobre la medida visible (el borde terminado, no la pieza agrandada).",
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
  if (unit === "ml_h" && quantitySource === "perimetro_lados_efecto") {
    return "m de borde/h";
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
  if (unit === "ml_h" && quantitySource === "perimetro_lados_efecto") {
    return "m de borde";
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
  /** Params del paso: el borde trabajado sale del efecto que él declara. */
  paramsPaso?: Record<string, unknown> | null,
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
    const conBorde = leerEfectoDemasia(paramsPaso) !== null;
    return T2_QUANTITY_SOURCE_OPTIONS.filter(
      (option) =>
        ["metros_lineales", "perimetro_piezas_m", "cantidad"].includes(
          option.value,
        ) || (conBorde && option.value === "perimetro_lados_efecto"),
    );
  }
  return [
    ...T2_QUANTITY_SOURCE_OPTIONS.filter(
      (option) => option.value === "cantidad",
    ),
    ...derivadas,
  ];
}

/**
 * Las magnitudes con las que se puede medir el ritmo, con su unidad puesta.
 *
 * Antes eran DOS controles: "Unidad" (ml/h, m²/h, unid./h) y "el ritmo cuenta"
 * (de dónde sale el número). Para el modelador es una sola idea —"30 metros de
 * borde por hora"— y separarlas obligaba a acertar la combinación: elegir m²/h
 * y después buscar qué área. Acá se ofrecen ya combinadas; al elegir una se
 * escriben los dos params, que es lo que el motor y el guardado esperan.
 */
export function getRitmoMagnitudOptions(
  familia?: FamiliaParaMagnitudes & FamiliaParaDefaults,
  paramsPaso?: Record<string, unknown> | null,
  unidadCantidad?: string | null,
): Array<{ value: string; label: string; unidad: string; fuente: string }> {
  const NOMBRES: Record<string, string> = {
    cantidad_montaje: "piezas a montar",
    area_piezas_m2: "metros cuadrados",
    m2_instalados: "m² instalados",
    metros_lineales: "metros lineales cotizados",
    perimetro_piezas_m: "metros de perímetro",
    perimetro_lados_efecto: "metros de borde",
  };
  const salida: Array<{
    value: string;
    label: string;
    unidad: string;
    fuente: string;
  }> = [];
  const vistos = new Set<string>();
  for (const unidad of ["unidades_h", "m2_h", "ml_h"]) {
    for (const opcion of getT2QuantitySourceOptions(
      unidad,
      familia,
      paramsPaso,
    )) {
      // "Cantidad efectiva del paso" existe bajo las tres unidades y es una
      // sola idea: se ofrece una vez, contando lo que el paso cuenta.
      if (opcion.value === "cantidad" && vistos.has("cantidad")) continue;
      vistos.add(opcion.value);
      const label =
        opcion.value === "cantidad"
          ? (unidadCantidad ?? "unidades")
          : (NOMBRES[opcion.value] ??
            (opcion.value.startsWith("derivada:")
              ? opcion.label.split(" (")[0].toLowerCase()
              : opcion.label.toLowerCase()));
      salida.push({
        value: `${unidad}|${opcion.value}`,
        label,
        unidad,
        fuente: opcion.value,
      });
    }
  }
  return salida;
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
 *  sistema y de tenant. [Tanda D: murieron la excepción pre_prensa y el
 *  atajo CALCULADO_POR_PASO — eran redundantes: toda familia que calcula
 *  acomodando declara su nesting (las de tenant lo exigen por validación),
 *  y las que calculan SIN acomodar (derivadores, cantidadPropia, pre-prensa)
 *  nunca debieron mostrar la card.] */
export function nestingAplica(
  familia:
    | { codigo?: string; nestingConfig?: unknown }
    | null
    | undefined,
  cfg: UpsertConfigPasoPayload,
) {
  void cfg;
  return Boolean(familia?.codigo && familia.nestingConfig);
}

/** "pliegos_impresos" → "Pliegos impresos" — para nombrar en la UI el output
 *  que la ficha declara heredar por default. [Tanda B] */
export function humanizarOutputCanonico(codigo: string): string {
  const texto = codigo.replaceAll("_", " ").trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
