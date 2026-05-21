import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function tableExists(name: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT to_regclass('"${name}"') IS NOT NULL AS exists`,
  );
  return rows[0]?.exists === true;
}

async function columnExists(tableName: string, columnName: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '${tableName}'
          AND column_name = '${columnName}'
      ) AS exists
    `,
  );
  return rows[0]?.exists === true;
}

async function main() {
  const hasLegacyProducto = await tableExists('ProductoServicio');
  const hasProducto = await tableExists('Producto');
  const hasRutaAlternativa = await tableExists('ProductoRutaAlternativa');
  const hasConfigPaso = await tableExists('ProductoConfigPaso');
  const hasRutaPaso = await tableExists('RutaPaso');

  if (
    !hasLegacyProducto ||
    !hasProducto ||
    !hasRutaAlternativa ||
    !hasConfigPaso ||
    !hasRutaPaso
  ) {
    console.log(
      'Migracion omitida: faltan tablas legacy o tablas del modelo actual.',
    );
    return;
  }

  const hasLegacyDetalle = await columnExists('ProductoServicio', 'detalleJson');
  const hasProductoVersion = await tableExists('ProductoVersion');
  const hasProductoVersionParams =
    hasProductoVersion && (await columnExists('ProductoVersion', 'parametrosJson'));

  const sourceParts: string[] = [];
  if (hasLegacyDetalle) sourceParts.push(`ps."detalleJson"->'imposicion'`);
  if (hasProductoVersionParams) sourceParts.push(`pv."parametrosJson"->'imposicion'`);

  if (sourceParts.length === 0) {
    console.log(
      'Migracion omitida: no se encontro ProductoServicio.detalleJson ni ProductoVersion.parametrosJson.',
    );
    return;
  }

  const sourceExpr = `COALESCE(${sourceParts.join(', ')})`;
  const joinProductoVersion = hasProductoVersionParams
    ? `
      LEFT JOIN "ProductoVersion" pv
        ON pv."tenantId" = ps."tenantId"
       AND pv."productoServicioId" = ps."id"
    `
    : '';

  const orderProductoVersion = hasProductoVersionParams
    ? `, pv."version" DESC NULLS LAST`
    : '';

  const migrated = await prisma.$executeRawUnsafe(`
    WITH legacy_source AS (
      SELECT DISTINCT ON (ps."tenantId", ps."codigo")
        ps."tenantId",
        ps."codigo",
        ${sourceExpr} AS imposicion
      FROM "ProductoServicio" ps
      ${joinProductoVersion}
      WHERE ${sourceExpr} IS NOT NULL
      ORDER BY ps."tenantId", ps."codigo"${orderProductoVersion}
    ),
    legacy_panel AS (
      SELECT
        legacy_source."tenantId",
        legacy_source."codigo",
        CASE
          WHEN jsonb_typeof(legacy_source.imposicion->'panelizado') = 'object'
            THEN legacy_source.imposicion->'panelizado'
          ELSE legacy_source.imposicion
        END AS panel
      FROM legacy_source
      WHERE legacy_source.imposicion ? 'panelizado'
         OR legacy_source.imposicion ? 'panelizadoActivo'
         OR legacy_source.imposicion ? 'panelizarPiezasGrandes'
         OR legacy_source.imposicion ? 'panelizadoModo'
         OR legacy_source.imposicion ? 'panelizadoDireccion'
         OR legacy_source.imposicion ? 'manualLayout'
         OR legacy_source.imposicion ? 'layoutManual'
    ),
    mapped_panel AS (
      SELECT
        legacy_panel."tenantId",
        legacy_panel."codigo",
        jsonb_strip_nulls(
          jsonb_build_object(
            'enabled',
              lower(coalesce(
                legacy_panel.panel->>'enabled',
                legacy_panel.panel->>'activo',
                legacy_panel.panel->>'panelizadoActivo',
                legacy_panel.panel->>'panelizarPiezasGrandes',
                'true'
              )) IN ('true', '1', 'si', 'yes', 'on'),
            'mode',
              CASE lower(coalesce(
                legacy_panel.panel->>'mode',
                legacy_panel.panel->>'modo',
                legacy_panel.panel->>'panelizadoModo',
                'automatic'
              ))
                WHEN 'manual' THEN 'manual'
                WHEN 'automatico' THEN 'automatic'
                ELSE 'automatic'
              END,
            'axis',
              CASE lower(coalesce(
                legacy_panel.panel->>'axis',
                legacy_panel.panel->>'eje',
                legacy_panel.panel->>'direccion',
                legacy_panel.panel->>'panelizadoDireccion',
                'automatic'
              ))
                WHEN 'automatica' THEN 'automatic'
                WHEN 'automatico' THEN 'automatic'
                WHEN 'automatic' THEN 'automatic'
                WHEN 'horizontal' THEN 'horizontal'
                ELSE 'vertical'
              END,
            'overlapMm',
              CASE
                WHEN coalesce(
                  legacy_panel.panel->>'overlapMm',
                  legacy_panel.panel->>'solapeMm',
                  legacy_panel.panel->>'panelizadoSolapeMm'
                ) ~ '^[0-9]+(\\.[0-9]+)?$'
                  THEN coalesce(
                    legacy_panel.panel->>'overlapMm',
                    legacy_panel.panel->>'solapeMm',
                    legacy_panel.panel->>'panelizadoSolapeMm'
                  )::numeric
                ELSE NULL
              END,
            'maxPanelWidthMm',
              CASE
                WHEN coalesce(
                  legacy_panel.panel->>'maxPanelWidthMm',
                  legacy_panel.panel->>'anchoMaximoPanelMm',
                  legacy_panel.panel->>'anchoMaxPanelMm',
                  legacy_panel.panel->>'panelizadoAnchoMaximoMm'
                  ) ~ '^[0-9]+(\\.[0-9]+)?$'
                  THEN CASE
                    WHEN coalesce(
                      legacy_panel.panel->>'maxPanelWidthMm',
                      legacy_panel.panel->>'anchoMaximoPanelMm',
                      legacy_panel.panel->>'anchoMaxPanelMm',
                      legacy_panel.panel->>'panelizadoAnchoMaximoMm'
                    )::numeric >= 300
                      THEN coalesce(
                        legacy_panel.panel->>'maxPanelWidthMm',
                        legacy_panel.panel->>'anchoMaximoPanelMm',
                        legacy_panel.panel->>'anchoMaxPanelMm',
                        legacy_panel.panel->>'panelizadoAnchoMaximoMm'
                      )::numeric
                    ELSE NULL
                  END
                ELSE NULL
              END,
            'distribution',
              CASE lower(coalesce(
                legacy_panel.panel->>'distribution',
                legacy_panel.panel->>'distribucion',
                'equilibrada'
              ))
                WHEN 'libre' THEN 'libre'
                ELSE 'equilibrada'
              END,
            'widthInterpretation',
              CASE lower(coalesce(
                legacy_panel.panel->>'widthInterpretation',
                legacy_panel.panel->>'interpretacionAncho',
                'total'
              ))
                WHEN 'util' THEN 'util'
                ELSE 'total'
              END,
            'manualLayout',
              CASE
                WHEN jsonb_typeof(coalesce(
                  legacy_panel.panel->'manualLayout',
                  legacy_panel.panel->'layoutManual'
                )) = 'object'
                  THEN coalesce(
                    legacy_panel.panel->'manualLayout',
                    legacy_panel.panel->'layoutManual'
                  )
                ELSE NULL
              END
          )
        ) AS panelizado
      FROM legacy_panel
    )
    UPDATE "ProductoConfigPaso" pcp
    SET "paramsPasoJson" = jsonb_set(
      jsonb_set(
        COALESCE(pcp."paramsPasoJson"::jsonb, '{}'::jsonb),
        '{nestingConfig}',
        COALESCE(pcp."paramsPasoJson"::jsonb #> '{nestingConfig}', '{}'::jsonb),
        true
      ),
      '{nestingConfig,panelizado}',
      mapped_panel.panelizado,
      true
    )
    FROM "ProductoRutaAlternativa" pra
    JOIN "Producto" p
      ON p."tenantId" = pra."tenantId"
     AND p."id" = pra."productoId"
    JOIN mapped_panel
      ON mapped_panel."tenantId" = p."tenantId"
     AND mapped_panel."codigo" = p."codigo"
    JOIN "RutaPaso" rp
      ON rp."tenantId" = pra."tenantId"
    WHERE pcp."tenantId" = pra."tenantId"
      AND pcp."productoRutaAlternativaId" = pra."id"
      AND rp."id" = pcp."rutaPasoId"
      AND rp."familiaCodigo" = 'impresion_por_area'
      AND coalesce(
        pcp."paramsPasoJson"::jsonb #>> '{nestingConfig,algorithm}',
        'auto'
      ) IN ('auto', 'shelf-rollo', 'maxrects-rollo')
      AND pcp."paramsPasoJson"::jsonb #> '{nestingConfig,panelizado}' IS NULL
  `);

  console.log(`Migracion de panelizado legacy finalizada. Pasos actualizados: ${migrated}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
