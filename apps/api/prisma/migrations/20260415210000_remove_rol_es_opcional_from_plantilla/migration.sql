-- Remove rol and esOpcional from ProcesoOperacionPlantilla
-- These fields belong to the route operation, not the reusable template

ALTER TABLE "ProcesoOperacionPlantilla" DROP COLUMN IF EXISTS "rol";
ALTER TABLE "ProcesoOperacionPlantilla" DROP COLUMN IF EXISTS "esOpcional";
