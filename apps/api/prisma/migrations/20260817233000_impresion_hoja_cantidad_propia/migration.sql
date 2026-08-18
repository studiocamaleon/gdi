-- La imposicion ahora pertenece al paso de impresion por hoja. Las
-- configuraciones legacy sin origen explicito todavia heredaban la cantidad
-- comercial desde pre-prensa y podian cobrar demasiadas hojas.
UPDATE "ProductoConfigPaso" AS config
SET "mecanismoCantidad" = 'CALCULADO_POR_PASO'
FROM "RutaPaso" AS paso
WHERE paso."id" = config."rutaPasoId"
  AND paso."familiaCodigo" = 'impresion_por_hoja'
  AND config."mecanismoCantidad" = 'HEREDAR_DEL_OUTPUT_CANONICO'
  AND config."mecanismoCantidadConfigJson" IS NULL;
