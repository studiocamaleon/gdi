DROP INDEX IF EXISTS "ProcesoOperacionPlantilla_tenantId_tipoProceso_idx";

ALTER TABLE "ProcesoOperacionPlantilla"
  DROP COLUMN IF EXISTS "tipoProceso";

ALTER TABLE "ProcesoDefinicion"
  DROP COLUMN IF EXISTS "tipoProceso";

DROP TYPE IF EXISTS "TipoProceso";
