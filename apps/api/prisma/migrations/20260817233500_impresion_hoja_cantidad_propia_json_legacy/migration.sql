-- Prisma puede persistir la ausencia de configuración como JSON null en vez
-- de SQL NULL. Completa la normalización para todas las variantes legacy que
-- no declararon un origen explícito de herencia.
UPDATE "ProductoConfigPaso" AS config
SET "mecanismoCantidad" = 'CALCULADO_POR_PASO'
FROM "RutaPaso" AS paso
WHERE paso."id" = config."rutaPasoId"
  AND paso."familiaCodigo" = 'impresion_por_hoja'
  AND config."mecanismoCantidad" = 'HEREDAR_DEL_OUTPUT_CANONICO'
  AND (
    config."mecanismoCantidadConfigJson" IS NULL
    OR jsonb_typeof(config."mecanismoCantidadConfigJson") <> 'object'
    OR NOT (config."mecanismoCantidadConfigJson" ? 'origen')
  );
