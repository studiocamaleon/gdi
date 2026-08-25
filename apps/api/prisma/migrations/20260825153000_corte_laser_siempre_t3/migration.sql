-- Corte láser obtiene el tiempo de ejecución del perímetro y de la velocidad
-- del perfil operativo. Normalizamos presets e instancias históricas que
-- quedaron sin modo (o con el antiguo modo manual) para evitar setup-only.

UPDATE "FamiliaPasoDefaults"
SET "configBaseJson" = jsonb_set(
  COALESCE("configBaseJson", '{}'::jsonb),
  '{modoTiempo}',
  '"T-3"'::jsonb,
  true
)
WHERE "familiaCodigo" = 'corte_laser';

UPDATE "ProductoPasoExtra"
SET "modoTiempo" = 'T-3'
WHERE "familiaCodigo" = 'corte_laser'
  AND "modoTiempo" IS DISTINCT FROM 'T-3';

UPDATE "ProductoConfigPaso" AS config
SET "modoTiempo" = 'T-3'
FROM "RutaPaso" AS paso
WHERE config."rutaPasoId" = paso.id
  AND paso."familiaCodigo" = 'corte_laser'
  AND config."modoTiempo" IS DISTINCT FROM 'T-3';
