-- Simplify TipoOperacionProceso: migrate data then remove unused values
-- Maps: PREFLIGHT,OTRO → PREPRENSA; CORTE,MECANIZADO,GRABADO,CURADO,LAMINADO,TRANSFERENCIA,CONTROL_CALIDAD,TERCERIZADO → TERMINACION

-- Step 1: Migrate existing data in all 3 tables that use TipoOperacionProceso

UPDATE "ProcesoOperacion"
SET "tipoOperacion" = 'PREPRENSA'
WHERE "tipoOperacion" IN ('PREFLIGHT', 'OTRO');

UPDATE "ProcesoOperacion"
SET "tipoOperacion" = 'TERMINACION'
WHERE "tipoOperacion" IN ('CORTE', 'MECANIZADO', 'GRABADO', 'CURADO', 'LAMINADO', 'TRANSFERENCIA', 'CONTROL_CALIDAD', 'TERCERIZADO');

UPDATE "ProcesoOperacionPlantilla"
SET "tipoOperacion" = 'PREPRENSA'
WHERE "tipoOperacion" IN ('PREFLIGHT', 'OTRO');

UPDATE "ProcesoOperacionPlantilla"
SET "tipoOperacion" = 'TERMINACION'
WHERE "tipoOperacion" IN ('CORTE', 'MECANIZADO', 'GRABADO', 'CURADO', 'LAMINADO', 'TRANSFERENCIA', 'CONTROL_CALIDAD', 'TERCERIZADO');

UPDATE "ProductoAdicionalRouteEffectPaso"
SET "tipoOperacion" = 'PREPRENSA'
WHERE "tipoOperacion" IN ('PREFLIGHT', 'OTRO');

UPDATE "ProductoAdicionalRouteEffectPaso"
SET "tipoOperacion" = 'TERMINACION'
WHERE "tipoOperacion" IN ('CORTE', 'MECANIZADO', 'GRABADO', 'CURADO', 'LAMINADO', 'TRANSFERENCIA', 'CONTROL_CALIDAD', 'TERCERIZADO');

-- Step 2: Remove unused enum values from TipoOperacionProceso
-- PostgreSQL requires creating a new enum type and swapping

CREATE TYPE "TipoOperacionProceso_new" AS ENUM ('PREPRENSA', 'IMPRESION', 'TERMINACION', 'LOGISTICA', 'EMPAQUE');

ALTER TABLE "ProcesoOperacion" ALTER COLUMN "tipoOperacion" TYPE "TipoOperacionProceso_new" USING ("tipoOperacion"::text::"TipoOperacionProceso_new");
ALTER TABLE "ProcesoOperacionPlantilla" ALTER COLUMN "tipoOperacion" TYPE "TipoOperacionProceso_new" USING ("tipoOperacion"::text::"TipoOperacionProceso_new");
ALTER TABLE "ProductoAdicionalRouteEffectPaso" ALTER COLUMN "tipoOperacion" TYPE "TipoOperacionProceso_new" USING ("tipoOperacion"::text::"TipoOperacionProceso_new");

DROP TYPE "TipoOperacionProceso";
ALTER TYPE "TipoOperacionProceso_new" RENAME TO "TipoOperacionProceso";

-- Step 3: Remove TABLA from ModoProductividadProceso
-- First migrate any TABLA records to FIJA (should be none, but safe)

UPDATE "ProcesoOperacion"
SET "modoProductividad" = 'FIJA'
WHERE "modoProductividad" = 'TABLA';

UPDATE "ProcesoOperacionPlantilla"
SET "modoProductividad" = 'FIJA'
WHERE "modoProductividad" = 'TABLA';

CREATE TYPE "ModoProductividadProceso_new" AS ENUM ('FIJA', 'FORMULA');

ALTER TABLE "ProcesoOperacion" ALTER COLUMN "modoProductividad" TYPE "ModoProductividadProceso_new" USING ("modoProductividad"::text::"ModoProductividadProceso_new");
ALTER TABLE "ProcesoOperacionPlantilla" ALTER COLUMN "modoProductividad" TYPE "ModoProductividadProceso_new" USING ("modoProductividad"::text::"ModoProductividadProceso_new");

DROP TYPE "ModoProductividadProceso";
ALTER TYPE "ModoProductividadProceso_new" RENAME TO "ModoProductividadProceso";
