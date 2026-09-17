/** Contrato puro, compartido con la interfaz. No depende de Nest ni de Prisma. */
export type MaterialEquivalence = {
  origen: string;
  destino: string;
  factor: number;
};
export type MaterialConversionStep = MaterialEquivalence & {
  origenFactor: 'fisica' | 'medidas' | 'manual';
};
export type MaterialUnitContext = {
  unidadStock: string;
  unidadUso?: string | null;
  equivalencias?: MaterialEquivalence[] | null;
  unidadCompra: string;
  unidadPrecio?: string | null;
  equivalenciaCompra?: number | null;
  templateId?: string | null;
  atributos?: Record<string, unknown> | null;
};

export type UnitConversion =
  | {
      ok: true;
      factor: number;
      origen: 'fisica' | 'medidas' | 'manual';
      pasos: MaterialConversionStep[];
    }
  | { ok: false; mensaje: string };

export function normalizeMaterialUnit(unit: string) {
  const key = unit.trim().toLowerCase();
  return key === 'pliego'
    ? 'hoja'
    : key === 'pieza'
      ? 'unidad'
      : ['m_lineales', 'metros_lineales', 'm_lineal'].includes(key)
        ? 'metro_lineal'
        : key;
}

// Solo relaciones físicas universales. Una caja, resma o rollo necesita contenido.
const PHYSICAL: Record<string, [string, number]> = {
  metro_lineal: ['longitud', 1],
  cm: ['longitud', 0.01],
  mm: ['longitud', 0.001],
  m2: ['area', 1],
  litro: ['volumen', 1],
  ml: ['volumen', 0.001],
  m3: ['volumen', 1000],
  kg: ['masa', 1],
  gramo: ['masa', 0.001],
};

function positive(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(typeof value === 'string' ? value.replace(',', '.') : value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Unidades canónicas declaradas por las plantillas; nunca se infieren por magnitud. */
const GEOMETRY: Record<
  string,
  { ancho?: number; alto?: number; largo?: number }
> = {
  sustrato_hoja_v1: { ancho: 0.01, alto: 0.01 },
  sustrato_rigido_v1: { ancho: 1, alto: 1 },
  sustrato_rollo_flexible_v1: { ancho: 1, largo: 1 },
  vinilo_de_corte_rollo_v1: { ancho: 1, largo: 1 },
  vinilo_esmerilado_rollo_v1: { ancho: 1, largo: 1 },
  componente_editorial_hoja_v1: { ancho: 0.01, alto: 0.01 },
  film_transferencia_v1: { ancho: 0.001, largo: 1 },
  papel_transferencia_v1: { ancho: 0.001, largo: 1 },
  laminado_film_v1: { ancho: 0.001, largo: 1 },
  laminado_pouch_v1: { ancho: 0.001, alto: 0.001 },
  iman_flexible_rollo_v1: { ancho: 0.001, largo: 1 },
};

type Edge = {
  to: string;
  factor: number;
  origen: 'fisica' | 'medidas' | 'manual';
};

type UnitGraph = Map<string, Edge[]>;
function addRelation(
  graph: UnitGraph,
  a: string,
  b: string,
  factor: number,
  origen: Edge['origen'],
) {
  if (!Number.isFinite(factor) || factor <= 0) return;
  a = normalizeMaterialUnit(a);
  b = normalizeMaterialUnit(b);
  graph.set(a, [...(graph.get(a) ?? []), { to: b, factor, origen }]);
  graph.set(b, [
    ...(graph.get(b) ?? []),
    { to: a, factor: 1 / factor, origen },
  ]);
}

export function readMaterialEquivalences(
  value: unknown,
): MaterialEquivalence[] | null {
  return Array.isArray(value) ? (value as MaterialEquivalence[]) : null;
}

/** Una lista explícita (incluso vacía) reemplaza al factor legado. */
export function materialEquivalences(
  context: MaterialUnitContext,
): MaterialEquivalence[] {
  if (
    context.equivalencias == null &&
    context.equivalenciaCompra === 1 &&
    normalizeMaterialUnit(context.unidadCompra) ===
      normalizeMaterialUnit(context.unidadStock)
  )
    return [];
  return (
    context.equivalencias ??
    (context.equivalenciaCompra == null
      ? []
      : [
          {
            origen: context.unidadCompra,
            destino: context.unidadStock,
            factor: context.equivalenciaCompra,
          },
        ])
  );
}

function resolveGraph(context: MaterialUnitContext, includeManual: boolean) {
  const graph: UnitGraph = new Map();
  const add = (a: string, b: string, factor: number, origen: Edge['origen']) =>
    addRelation(graph, a, b, factor, origen);
  // Misma unidad física; conservamos el término elegido para mostrarlo.
  add('hoja', 'placa', 1, 'fisica');
  for (const [a, [dimension, factor]] of Object.entries(PHYSICAL)) {
    for (const [b, [otherDimension, otherFactor]] of Object.entries(PHYSICAL)) {
      if (a < b && dimension === otherDimension)
        add(a, b, factor / otherFactor, 'fisica');
    }
  }
  const attrs = context.atributos ?? {};
  const geometry = GEOMETRY[context.templateId ?? ''];
  const dimension = (key: 'ancho' | 'alto' | 'largo', aliases: string[]) => {
    const canonical = positive(attrs[key]);
    const scale = geometry?.[key];
    if (canonical !== null && scale !== undefined) return canonical * scale;
    for (const alias of aliases) {
      const value = positive(attrs[alias]);
      if (value !== null) return value / 1000;
    }
    return null;
  };
  const width = dimension('ancho', ['anchoMm', 'anchoRolloMm']);
  const length = dimension('largo', ['largoRolloMm', 'largoMm']);
  const height = dimension('alto', ['altoMm', 'largoMm']);
  const isRoll =
    geometry?.largo !== undefined || positive(attrs.largoRolloMm) !== null;
  if (isRoll) {
    if (length) add('rollo', 'metro_lineal', length, 'medidas');
    if (width) add('metro_lineal', 'm2', width, 'medidas');
  } else if (width && height) {
    add('hoja', 'm2', width * height, 'medidas');
  }
  if (context.templateId === 'perfil_estructural_v1') {
    const barLength = positive(attrs.largoBarra);
    if (barLength) add('unidad', 'metro_lineal', barLength, 'medidas');
  }
  if (
    ['tinta_impresion_v1', 'quimico_acabado_v1'].includes(
      context.templateId ?? '',
    )
  ) {
    const volume = positive(attrs.volumenPresentacion ?? attrs.volumenMl);
    if (volume) {
      add('unidad', 'ml', volume, 'medidas');
      // El volumen corresponde a la presentación de esta variante, no a un litro fijo.
      add('botella', 'ml', volume, 'medidas');
    }
  }
  if (includeManual)
    for (const relation of materialEquivalences(context)) {
      add(relation.origen, relation.destino, relation.factor, 'manual');
    }
  return graph;
}

function findConversion(
  graph: UnitGraph,
  from: string,
  to: string,
): UnitConversion {
  const source = normalizeMaterialUnit(from),
    target = normalizeMaterialUnit(to);
  if (!source || !target)
    return { ok: false, mensaje: 'Indicá las unidades a convertir.' };
  if (source === target)
    return { ok: true, factor: 1, origen: 'fisica', pasos: [] };
  const queue: Array<{
    unit: string;
    factor: number;
    origen: Edge['origen'];
    pasos: MaterialConversionStep[];
  }> = [{ unit: source, factor: 1, origen: 'fisica', pasos: [] }];
  const seen = new Set([source]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const edge of graph.get(current.unit) ?? []) {
      if (seen.has(edge.to)) continue;
      const factor = current.factor * edge.factor;
      const origen =
        edge.origen === 'manual' || current.origen === 'manual'
          ? 'manual'
          : edge.origen === 'medidas' || current.origen === 'medidas'
            ? 'medidas'
            : 'fisica';
      const pasos = [
        ...current.pasos,
        {
          origen: current.unit,
          destino: edge.to,
          factor: edge.factor,
          origenFactor: edge.origen,
        },
      ];
      if (!Number.isFinite(factor) || factor <= 0)
        return {
          ok: false,
          mensaje: 'El coeficiente de conversión excede la precisión admitida.',
        };
      if (edge.to === target) return { ok: true, factor, origen, pasos };
      seen.add(edge.to);
      queue.push({ unit: edge.to, factor, origen, pasos });
    }
  }
  return {
    ok: false,
    mensaje: `Falta definir la conversión de ${source} a ${target}.`,
  };
}

export function materialUnitConversion(
  context: MaterialUnitContext,
  from: string,
  to: string,
  includeManual = true,
): UnitConversion {
  if (includeManual) {
    const error = validateMaterialUnits(context);
    if (error) return { ok: false, mensaje: error };
  }
  return findConversion(resolveGraph(context, includeManual), from, to);
}

export function validateMaterialUnits(
  context: MaterialUnitContext,
): string | null {
  const graph = resolveGraph(context, false);
  const relations = materialEquivalences(context);
  if (relations.length > 20)
    return 'Se admiten hasta 20 coeficientes de conversión por variante.';
  for (const relation of relations) {
    if (
      !relation ||
      typeof relation.origen !== 'string' ||
      typeof relation.destino !== 'string' ||
      !relation.origen ||
      !relation.destino
    )
      return 'Indicá las dos unidades de cada coeficiente.';
    const factor = positive(relation.factor);
    if (factor == null) return 'Ingresá un coeficiente mayor que cero.';
    if (factor > 1e12) return 'El coeficiente supera la precisión admitida.';
    if (
      normalizeMaterialUnit(relation.origen) ===
      normalizeMaterialUnit(relation.destino)
    ) {
      if (context.equivalencias == null && factor === 1) continue;
      return 'Elegí dos unidades distintas para el coeficiente.';
    }
    const existing = findConversion(graph, relation.origen, relation.destino);
    if (
      existing.ok &&
      Math.abs(existing.factor - factor) > 1e-8 * Math.max(1, existing.factor)
    )
      return `El coeficiente contradice las medidas, unidades u otra relación: 1 ${relation.origen} corresponde a ${existing.factor} ${relation.destino}.`;
    addRelation(graph, relation.origen, relation.destino, factor, 'manual');
  }
  return null;
}

export function materialPriceInUseUnit(
  context: MaterialUnitContext,
  price: number,
) {
  return materialPriceInUnit(
    context,
    price,
    context.unidadUso ?? context.unidadStock,
  );
}

export function materialPriceInStockUnit(
  context: MaterialUnitContext,
  price: number,
) {
  return materialPriceInUnit(context, price, context.unidadStock);
}

export function materialPriceInUnit(
  context: MaterialUnitContext,
  price: number,
  targetUnit: string,
): { ok: true; precio: number } | { ok: false; mensaje: string } {
  if (!context.unidadPrecio)
    return {
      ok: false,
      mensaje:
        'Confirmá la unidad del precio informado en la ficha del material.',
    };
  const invalid = validateMaterialUnits(context);
  if (invalid) return { ok: false, mensaje: invalid };
  const conversion = materialUnitConversion(
    context,
    context.unidadPrecio,
    targetUnit,
  );
  if (!conversion.ok) return conversion;
  return { ok: true, precio: price / conversion.factor };
}

/** Adaptador estructural para registros de Prisma, también utilizable desde pruebas. */
export type MaterialPriceRecord = {
  precioReferencia?: unknown;
  unidadPrecio?: string | null;
  equivalenciaCompra?: unknown;
  unidadStock?: string | null;
  unidadUso?: string | null;
  equivalenciasJson?: unknown;
  unidadCompra?: string | null;
  atributosVarianteJson?: unknown;
  materiaPrima?: {
    unidadStock?: string | null;
    unidadUso?: string | null;
    unidadCompra?: string | null;
    templateId?: string | null;
  } | null;
};

export function materialPriceContext(
  record: MaterialPriceRecord,
): MaterialUnitContext {
  const stock = record.unidadStock ?? record.materiaPrima?.unidadStock ?? '';
  const compra =
    record.unidadCompra ?? record.materiaPrima?.unidadCompra ?? stock;
  return {
    unidadStock: stock,
    unidadUso: record.unidadUso ?? record.materiaPrima?.unidadUso ?? stock,
    equivalencias: readMaterialEquivalences(record.equivalenciasJson),
    unidadCompra: compra,
    // Compatibilidad con registros sin precio explícito: solo si no existe ambigüedad.
    unidadPrecio:
      record.unidadPrecio ??
      (normalizeMaterialUnit(stock) === normalizeMaterialUnit(compra)
        ? stock
        : null),
    equivalenciaCompra:
      record.equivalenciaCompra == null
        ? null
        : Number(record.equivalenciaCompra),
    templateId: record.materiaPrima?.templateId,
    atributos: record.atributosVarianteJson as Record<string, unknown> | null,
  };
}

export function normalizedMaterialPrice(
  record: MaterialPriceRecord,
): number | null {
  if (record.precioReferencia == null) return null;
  const result = materialPriceInUseUnit(
    materialPriceContext(record),
    Number(record.precioReferencia),
  );
  return result.ok ? result.precio : null;
}
