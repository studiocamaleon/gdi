import { Prisma } from '@prisma/client';
import { claveMaterialNesting } from './identidad-material-cola';
import {
  medidasPiezasCola,
  medidasPanelesCola,
  type MedidaPanelCola,
} from './medidas-cola';
import { restaurarDatosSnapshot } from '../../prisma/snapshots.extension';

const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const texto = (v: unknown) =>
  typeof v === 'string' && v.trim() ? v.trim() : null;
const positivo = (v: unknown) => {
  const n = typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function normalizarColorCola(v: unknown): string | null {
  const original = texto(v);
  if (!original) return null;
  const c = original.toUpperCase().replace(/\s/g, '');
  if (['BN', 'B/N', 'B&N', 'BYN', 'NEGRO', 'K', 'BLANCOYNEGRO'].includes(c))
    return 'BN';
  if (c === 'CMYK') return 'CMYK';
  const partes = c.split('+');
  if (
    partes[0] === 'CMYK' &&
    partes
      .slice(1)
      .every((p) => ['W', 'BLANCO', 'V', 'BARNIZ', 'VARNISH'].includes(p))
  ) {
    return [
      'CMYK',
      ...(partes.some((p) => ['W', 'BLANCO'].includes(p)) ? ['blanco'] : []),
      ...(partes.some((p) => ['V', 'BARNIZ', 'VARNISH'].includes(p))
        ? ['barniz']
        : []),
    ].join(' + ');
  }
  return original;
}

function formatos(v: unknown) {
  const unicos = new Map<
    string,
    { tipo: 'roll' | 'sheet'; anchoMm: number; altoMm: number | null }
  >();
  for (const valor of Array.isArray(v) ? v : []) {
    const s = objeto(valor),
      anchoMm = positivo(s.widthMm);
    if (!anchoMm || (s.kind !== 'roll' && s.kind !== 'sheet')) continue;
    const f = {
      tipo: s.kind,
      anchoMm,
      altoMm: s.kind === 'sheet' ? positivo(s.heightMm) : null,
    } as const;
    unicos.set(JSON.stringify(f), f);
  }
  return [...unicos.values()].sort(
    (a, b) => a.anchoMm - b.anchoMm || (a.altoMm ?? 0) - (b.altoMm ?? 0),
  );
}

export type FuenteConfiguracionCola = {
  pasoId: string;
  original: unknown;
  compartido: unknown;
  contexto: unknown;
  impresionesEnContexto: number;
  geometria?: unknown;
  productoCompuesto?: boolean;
};

/** Sólo lee metadatos: no accede a placements, contornos ni geometría diferida. */
export function configurarFilaCola(fuente: FuenteConfiguracionCola) {
  const original = objeto(fuente.original),
    lote = objeto(fuente.compartido),
    job = objeto(fuente.contexto);
  const nOriginal = objeto(original.nestingResult);
  const esCompartido = Object.keys(objeto(lote.nestingResult)).length > 0;
  const n = esCompartido ? objeto(lote.nestingResult) : nOriginal;
  const sustrato = objeto(n.sustrato),
    material = objeto(original.material),
    perfil = objeto(n.perfil);
  const esImpresion =
    typeof original.familiaCodigo === 'string' &&
    original.familiaCodigo.startsWith('impresion_');
  const configId = texto(original.configPasoId);
  const colorEspecifico = configId
    ? objeto(job.modoColorPorPaso)[configId]
    : null;
  // El modo general no debe atribuir el color de un componente a otro paso.
  const color =
    n.modoColor ??
    colorEspecifico ??
    (esImpresion && fuente.impresionesEnContexto === 1 ? job.modoColor : null);
  const formatosPrevistos = formatos(n.substrates);
  const formatosCotizados = formatos(nOriginal.substrates);
  const varianteId =
    texto(lote.materialVarianteId) ??
    texto(sustrato.materialVarianteId) ??
    texto(material.materialVarianteId);
  const nombreMaterial =
    texto(lote.materialNombre) ??
    texto(sustrato.nombre) ??
    texto(sustrato.materialDisplayName) ??
    texto(sustrato.materiaPrimaNombre) ??
    (varianteId === texto(material.materialVarianteId) || !esCompartido
      ? (texto(material.materialDisplayName) ??
        texto(material.materiaPrimaNombre))
      : null);
  return {
    productoCompuesto: fuente.productoCompuesto === true,
    piezas: medidasPiezasCola(job),
    panelesPorPiezaMax: n.panelizado === true ? positivo(n.paneles) : null,
    paneles: [] as MedidaPanelCola[],
    familiaCodigo: texto(original.familiaCodigo),
    materialId: varianteId,
    materiaPrimaId: null as string | null,
    materialNestingClave: null as string | null,
    materialNombre: nombreMaterial,
    materialSubfamilia: null as string | null,
    modoColor: normalizarColorCola(color),
    tecnologia: texto(n.tecnologia),
    perfilId: texto(perfil.id),
    perfilNombre: texto(perfil.nombre),
    caras:
      n.carasProcesadas === 1 || n.carasProcesadas === 2
        ? n.carasProcesadas
        : null,
    formatos: formatosPrevistos,
    formatosCotizados,
    formatoModificado:
      formatosPrevistos.length > 0 &&
      formatosCotizados.length > 0 &&
      JSON.stringify(formatosPrevistos) !== JSON.stringify(formatosCotizados),
    layoutConservado:
      fuente.productoCompuesto === true ||
      esCompartido ||
      Boolean(
        n.layoutVinculadoGeometriaVectorial ||
        n.layoutRegistradoLoteId ||
        n.loteNestingCompuesto ||
        n.estrategiaDisposicion === 'composicion_original' ||
        n.algorithm === 'irregular-2d-bottom-left-v1',
      ),
    ejecucionCompartida: esCompartido,
  };
}

export type ConfiguracionCola = ReturnType<typeof configurarFilaCola>;

/** La geometría comprimida vive separada de estos metadatos en el JSON.
 * Proyectar en PostgreSQL evita transferir/descomprimir un CAD por cada fila. */
function nestingSql(n: Prisma.Sql) {
  return Prisma.sql`jsonb_strip_nulls(jsonb_build_object(
    'sustrato', NULLIF(jsonb_strip_nulls(jsonb_build_object('materialVarianteId', ${n}->'sustrato'->'materialVarianteId',
      'nombre', ${n}->'sustrato'->'nombre', 'materialDisplayName', ${n}->'sustrato'->'materialDisplayName',
      'materiaPrimaNombre', ${n}->'sustrato'->'materiaPrimaNombre')), '{}'::jsonb),
    'perfil', NULLIF(jsonb_strip_nulls(jsonb_build_object('id', ${n}->'perfil'->'id', 'nombre', ${n}->'perfil'->'nombre')), '{}'::jsonb),
    'substrates', (SELECT jsonb_agg(DISTINCT jsonb_build_object('kind', soporte.valor->'kind',
      'widthMm', soporte.valor->'widthMm', 'heightMm', soporte.valor->'heightMm'))
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${n}->'substrates') = 'array'
        THEN ${n}->'substrates' ELSE '[]'::jsonb END) AS soporte(valor)),
    'modoColor', ${n}->'modoColor', 'tecnologia', ${n}->'tecnologia', 'carasProcesadas', ${n}->'carasProcesadas',
    'panelizado', ${n}->'visualConfig'->'panelizado'->'enabled', 'paneles', ${n}->'visualConfig'->'panelizado'->'panelCount',
    'algorithm', ${n}->'algorithm', 'estrategiaDisposicion', ${n}->'estrategiaDisposicion',
    'layoutVinculadoGeometriaVectorial', ${n}->'layoutVinculadoGeometriaVectorial',
    'layoutRegistradoLoteId', ${n}->'layoutRegistradoLoteId', 'loteNestingCompuesto', ${n}->'loteNestingCompuesto'

  ))`;
}

/** Proyecta sólo medidas y cantidades, sin copiar vectores, archivos o datos de precios. */
function medidasSql(job: Prisma.Sql) {
  return Prisma.sql`jsonb_build_object(
    'cantidad', ${job}->'cantidad',
    'medidaCustomMm', jsonb_build_object('anchoMm', ${job}->'medidaCustomMm'->'anchoMm', 'altoMm', ${job}->'medidaCustomMm'->'altoMm'),
    'piezas', (SELECT jsonb_agg(jsonb_build_object('cantidad', pieza->'cantidad', 'anchoMm', pieza->'anchoMm', 'altoMm', pieza->'altoMm'))
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${job}->'piezas') = 'array' THEN ${job}->'piezas' ELSE '[]'::jsonb END) pieza)
  )`;
}

export async function leerConfiguracionesCola(
  db: Prisma.TransactionClient,
  tenantId: string,
  ids: string[],
) {
  if (!ids.length) return new Map<string, ConfiguracionCola>();
  const fuentes = await leerFuentesCola(db, tenantId, ids);
  const configuraciones = new Map(
    fuentes.map((f) => [f.pasoId, configurarFilaCola(f)]),
  );
  const panelizados = [...configuraciones]
    .filter(([, c]) => (c.panelesPorPiezaMax ?? 0) > 1)
    .map(([id]) => id);
  if (panelizados.length) {
    // Sólo los trabajos panelizados de esta página necesitan sus medidas calculadas.
    const fuentesPaneles = await leerFuentesCola(
      db,
      tenantId,
      panelizados,
      'paneles',
    );
    for (const fuente of fuentesPaneles) {
      const c = configuraciones.get(fuente.pasoId)!;
      try {
        const guardado = { ...objeto(fuente.geometria) };
        if (!guardado.__grafo_geometrias_v2)
          delete guardado.__grafo_geometrias_v2;
        const leido = restaurarDatosSnapshot('OrdenTrabajoItem', {
          trazabilidadSnapshotJson: guardado,
        });
        c.paneles = medidasPanelesCola(
          leido.trazabilidadSnapshotJson.placements,
        );
      } catch {
        // La UI informa las medidas faltantes; no reemplazarlas por la pieza completa.
        c.paneles = [];
      }
    }
  }
  const variantesIds = [
    ...new Set(
      [...configuraciones.values()].flatMap((c) =>
        c.materialId &&
        /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(c.materialId)
          ? [c.materialId]
          : [],
      ),
    ),
  ];
  if (!variantesIds.length) return configuraciones;
  // Una consulta de variantes por página, nunca una por trabajo.
  const variantes = await db.materiaPrimaVariante.findMany({
    where: { tenantId, id: { in: variantesIds }, materiaPrima: { tenantId } },
    select: {
      id: true,
      materiaPrimaId: true,
      atributosVarianteJson: true,
      materiaPrima: { select: { nombre: true, subfamilia: true } },
    },
  });
  const porVariante = new Map(variantes.map((v) => [v.id, v]));
  for (const c of configuraciones.values()) {
    const variante = porVariante.get(c.materialId ?? '');
    if (!variante) continue;
    c.materiaPrimaId = variante.materiaPrimaId;
    c.materialNombre = variante.materiaPrima.nombre;
    c.materialSubfamilia = variante.materiaPrima.subfamilia;
    c.materialNestingClave = claveMaterialNesting(
      variante.materiaPrimaId,
      variante.atributosVarianteJson,
    );
  }
  return configuraciones;
}

/** Proyección liviana de la configuración de cada operación. */
export async function leerFuentesCola(
  db: Prisma.TransactionClient,
  tenantId: string,
  ids: string[],
  detalle: boolean | 'paneles' = false,
) {
  if (!ids.length) return [];
  const compartido = Prisma.sql`p."nestingLoteRol" = 'OPERATIVO' AND jsonb_typeof(p."nestingLoteSnapshotJson"->'nestingResult') = 'object'`;
  const posiciones = Prisma.sql`(CASE WHEN ${compartido} THEN p."nestingLoteSnapshotJson"->'nestingResult'->'placements' ELSE origen.x->'nestingResult'->'placements' END)`;
  const fuentes = await db.$queryRaw<FuenteConfiguracionCola[]>(Prisma.sql`
    WITH RECURSIVE ascendencia AS (
      SELECT p.id AS "pasoId", i.id AS "itemId", i."tenantId", i."ordenId", i."parentItemId", i."componenteCodigo",
        ARRAY[]::text[] AS camino, ARRAY[i.id] AS visitados,
        COALESCE(NULLIF(i."trazabilidadSnapshotJson", 'null'::jsonb), NULLIF(c."trazabilidadJson", 'null'::jsonb)) AS traza,
        COALESCE(NULLIF(i."jobContextSnapshotJson", 'null'::jsonb), NULLIF(c."jobContextJson", 'null'::jsonb)) AS job
      FROM "OrdenTrabajoItemPaso" p
      JOIN "OrdenTrabajoItem" i ON i.id = p."itemId" AND i."tenantId" = p."tenantId" AND i."ordenId" = p."ordenId"
      LEFT JOIN "CotizacionItem" c ON c.id = i."cotizacionItemId" AND c."tenantId" = i."tenantId"
      WHERE p."tenantId" = ${tenantId}::uuid AND p.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      UNION ALL
      SELECT a."pasoId", padre.id, padre."tenantId", padre."ordenId", padre."parentItemId", padre."componenteCodigo",
        array_prepend(a."componenteCodigo"::text, a.camino), a.visitados || padre.id,
        COALESCE(NULLIF(padre."trazabilidadSnapshotJson", 'null'::jsonb), NULLIF(c."trazabilidadJson", 'null'::jsonb)),
        COALESCE(NULLIF(padre."jobContextSnapshotJson", 'null'::jsonb), NULLIF(c."jobContextJson", 'null'::jsonb))
      FROM ascendencia a
      JOIN "OrdenTrabajoItem" padre ON padre.id = a."parentItemId" AND padre."tenantId" = a."tenantId" AND padre."ordenId" = a."ordenId"
      LEFT JOIN "CotizacionItem" c ON c.id = padre."cotizacionItemId" AND c."tenantId" = padre."tenantId"
      WHERE a.traza IS NULL AND a."componenteCodigo" IS NOT NULL AND NOT padre.id = ANY(a.visitados)
    ), contextos AS (
      SELECT "pasoId", camino, 1 AS nivel, traza, job, traza->'__grafo_geometrias_v2' AS bloques FROM ascendencia WHERE traza IS NOT NULL
      UNION ALL
      SELECT a."pasoId", a.camino, a.nivel + 1, hijo.valor, NULLIF(hijo.valor->'jobContext', 'null'::jsonb), a.bloques
      FROM contextos a
      CROSS JOIN LATERAL (
        SELECT componente.valor FROM jsonb_array_elements(CASE
          WHEN jsonb_typeof(a.traza->'componentesFabricados') = 'array' THEN a.traza->'componentesFabricados'
          WHEN jsonb_typeof(a.traza->'componentes') = 'array' THEN a.traza->'componentes' ELSE '[]'::jsonb END) AS componente(valor)
        WHERE componente.valor->>'codigo' = a.camino[a.nivel]
      ) hijo
      WHERE a.nivel <= cardinality(a.camino)
    ), resueltos AS (
      SELECT "pasoId", traza, job, bloques FROM contextos WHERE nivel > cardinality(camino)
    )
    SELECT p.id AS "pasoId",
      (i."componenteCodigo" IS NOT NULL OR EXISTS (
        SELECT 1 FROM "OrdenTrabajoItem" hijo WHERE hijo."parentItemId" = i.id
          AND hijo."tenantId" = p."tenantId" AND hijo."componenteCodigo" IS NOT NULL
      )) AS "productoCompuesto",
      ${
        detalle === 'paneles'
          ? Prisma.sql`jsonb_build_object(
            'placements', CASE WHEN jsonb_typeof(${posiciones}) = 'array' THEN (
              SELECT jsonb_agg(jsonb_build_object('widthMm', panel->'widthMm', 'heightMm', panel->'heightMm',
                'rotated', panel->'rotated', 'panelIndex', panel->'panelIndex', 'panelCount', panel->'panelCount'))
              FROM jsonb_array_elements(${posiciones}) panel
            ) ELSE ${posiciones} END,
            '__grafo_geometrias_v2', CASE WHEN ${compartido} THEN p."nestingLoteSnapshotJson"->'__grafo_geometrias_v2' ELSE resueltos.bloques END
          )`
          : detalle
            ? Prisma.sql`jsonb_build_object(
        'nestingResult', jsonb_build_object(
          'placements', origen.x->'nestingResult'->'placements',
          'visualConfig', origen.x->'nestingResult'->'visualConfig',
          'algorithm', origen.x->'nestingResult'->'algorithm'),
        '__grafo_geometrias_v2', resueltos.bloques
      )`
            : Prisma.sql`NULL`
      } AS geometria,
      jsonb_build_object('configPasoId', origen.x->'configPasoId', 'familiaCodigo', p."familiaCodigo",
        'nestingResult', ${nestingSql(Prisma.sql`(origen.x->'nestingResult')`)},
        'material', jsonb_build_object('materialVarianteId', material.x->'materialVarianteId',
          'materialDisplayName', material.x->'materialDisplayName', 'materiaPrimaNombre', material.x->'materiaPrimaNombre')) AS original,
      CASE WHEN p."nestingLoteRol" = 'OPERATIVO' AND jsonb_typeof(p."nestingLoteSnapshotJson"->'nestingResult') = 'object'
      THEN jsonb_build_object('materialVarianteId', p."nestingLoteSnapshotJson"->'materialVarianteId',
        'materialNombre', p."nestingLoteSnapshotJson"->'materialNombre',
        'nestingResult', ${nestingSql(Prisma.sql`(p."nestingLoteSnapshotJson"->'nestingResult')`)}) ELSE NULL END AS compartido,
      (jsonb_build_object('modoColor', fuente.job->'modoColor', 'modoColorPorPaso', fuente.job->'modoColorPorPaso')
        || ${medidasSql(Prisma.sql`fuente.job`)}
        || ${detalle === true ? Prisma.sql`jsonb_build_object('configPasoRuntime', fuente.job->'configPasoRuntime')` : Prisma.sql`'{}'::jsonb`}) AS contexto,
      (SELECT count(*)::int FROM jsonb_array_elements(fuente.pasos) AS pasos_contexto(valor)
        WHERE pasos_contexto.valor->>'activado' IS DISTINCT FROM 'false' AND pasos_contexto.valor->>'familiaCodigo' LIKE 'impresion_%') AS "impresionesEnContexto"
    FROM "OrdenTrabajoItemPaso" p
    JOIN "OrdenTrabajoItem" i ON i.id = p."itemId" AND i."tenantId" = p."tenantId"
    LEFT JOIN "CotizacionItem" c ON c.id = i."cotizacionItemId" AND c."tenantId" = p."tenantId"
    LEFT JOIN resueltos ON resueltos."pasoId" = p.id
    CROSS JOIN LATERAL (
      SELECT COALESCE(NULLIF(i."jobContextSnapshotJson", 'null'::jsonb), NULLIF(c."jobContextJson", 'null'::jsonb), resueltos.job) AS job,
        CASE WHEN jsonb_typeof(resueltos.traza->'pasos') = 'array'
          THEN resueltos.traza->'pasos' ELSE '[]'::jsonb END AS pasos
    ) fuente
    LEFT JOIN LATERAL (SELECT paso_origen.valor AS x FROM jsonb_array_elements(fuente.pasos) AS paso_origen(valor)
      WHERE paso_origen.valor->>'rutaPasoId' = p."rutaPasoId" LIMIT 1) origen ON true
    LEFT JOIN LATERAL (SELECT material_origen.valor AS x FROM jsonb_array_elements(CASE WHEN jsonb_typeof(origen.x->'materiales') = 'array'
      THEN origen.x->'materiales' ELSE '[]'::jsonb END) AS material_origen(valor)
      WHERE material_origen.valor->>'tipoLineaCosto' = 'MATERIAL' LIMIT 1) material ON true
    WHERE p."tenantId" = ${tenantId}::uuid AND p.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
  `);
  return fuentes;
}
