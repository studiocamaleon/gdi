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

-- Migrate data in ProductoAdicionalNivel tipoOperacion if column exists (from discarded v2 branch)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProductoAdicionalNivel' AND column_name = 'tipoOperacion') THEN
    UPDATE "ProductoAdicionalNivel" SET "tipoOperacion" = 'PREPRENSA' WHERE "tipoOperacion" IN ('PREFLIGHT', 'OTRO');
    UPDATE "ProductoAdicionalNivel" SET "tipoOperacion" = 'TERMINACION' WHERE "tipoOperacion" IN ('CORTE', 'MECANIZADO', 'GRABADO', 'CURADO', 'LAMINADO', 'TRANSFERENCIA', 'CONTROL_CALIDAD', 'TERCERIZADO');
  END IF;
END $$;

CREATE TYPE "TipoOperacionProceso_new" AS ENUM ('PREPRENSA', 'IMPRESION', 'TERMINACION', 'LOGISTICA', 'EMPAQUE');

ALTER TABLE "ProcesoOperacion" ALTER COLUMN "tipoOperacion" TYPE "TipoOperacionProceso_new" USING ("tipoOperacion"::text::"TipoOperacionProceso_new");
ALTER TABLE "ProcesoOperacionPlantilla" ALTER COLUMN "tipoOperacion" TYPE "TipoOperacionProceso_new" USING ("tipoOperacion"::text::"TipoOperacionProceso_new");
ALTER TABLE "ProductoAdicionalRouteEffectPaso" ALTER COLUMN "tipoOperacion" TYPE "TipoOperacionProceso_new" USING ("tipoOperacion"::text::"TipoOperacionProceso_new");

-- Also alter ProductoAdicionalNivel tipoOperacion if column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProductoAdicionalNivel' AND column_name = 'tipoOperacion') THEN
    EXECUTE 'ALTER TABLE "ProductoAdicionalNivel" ALTER COLUMN "tipoOperacion" TYPE "TipoOperacionProceso_new" USING ("tipoOperacion"::text::"TipoOperacionProceso_new")';
  END IF;
END $$;

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

-- Migrate ProductoAdicionalRouteEffectPaso and ProductoAdicionalNivel too (from discarded v2 branch)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProductoAdicionalRouteEffectPaso' AND column_name = 'modoProductividad') THEN
    UPDATE "ProductoAdicionalRouteEffectPaso" SET "modoProductividad" = 'FIJA' WHERE "modoProductividad" = 'TABLA';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProductoAdicionalNivel' AND column_name = 'modoProductividad') THEN
    UPDATE "ProductoAdicionalNivel" SET "modoProductividad" = 'FIJA' WHERE "modoProductividad" = 'TABLA';
  END IF;
END $$;

CREATE TYPE "ModoProductividadProceso_new" AS ENUM ('FIJA', 'FORMULA');

-- Drop defaults temporarily to allow type change
ALTER TABLE "ProcesoOperacion" ALTER COLUMN "modoProductividad" DROP DEFAULT;
ALTER TABLE "ProcesoOperacionPlantilla" ALTER COLUMN "modoProductividad" DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProductoAdicionalRouteEffectPaso' AND column_name = 'modoProductividad') THEN
    EXECUTE 'ALTER TABLE "ProductoAdicionalRouteEffectPaso" ALTER COLUMN "modoProductividad" DROP DEFAULT';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProductoAdicionalNivel' AND column_name = 'modoProductividad') THEN
    EXECUTE 'ALTER TABLE "ProductoAdicionalNivel" ALTER COLUMN "modoProductividad" DROP DEFAULT';
  END IF;
END $$;

ALTER TABLE "ProcesoOperacion" ALTER COLUMN "modoProductividad" TYPE "ModoProductividadProceso_new" USING ("modoProductividad"::text::"ModoProductividadProceso_new");
ALTER TABLE "ProcesoOperacionPlantilla" ALTER COLUMN "modoProductividad" TYPE "ModoProductividadProceso_new" USING ("modoProductividad"::text::"ModoProductividadProceso_new");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProductoAdicionalRouteEffectPaso' AND column_name = 'modoProductividad') THEN
    EXECUTE 'ALTER TABLE "ProductoAdicionalRouteEffectPaso" ALTER COLUMN "modoProductividad" TYPE "ModoProductividadProceso_new" USING ("modoProductividad"::text::"ModoProductividadProceso_new")';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProductoAdicionalNivel' AND column_name = 'modoProductividad') THEN
    EXECUTE 'ALTER TABLE "ProductoAdicionalNivel" ALTER COLUMN "modoProductividad" TYPE "ModoProductividadProceso_new" USING ("modoProductividad"::text::"ModoProductividadProceso_new")';
  END IF;
END $$;

DROP TYPE "ModoProductividadProceso";
ALTER TYPE "ModoProductividadProceso_new" RENAME TO "ModoProductividadProceso";

-- Restore defaults
ALTER TABLE "ProcesoOperacion" ALTER COLUMN "modoProductividad" SET DEFAULT 'FIJA';
ALTER TABLE "ProcesoOperacionPlantilla" ALTER COLUMN "modoProductividad" SET DEFAULT 'FIJA';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProductoAdicionalRouteEffectPaso' AND column_name = 'modoProductividad') THEN
    EXECUTE 'ALTER TABLE "ProductoAdicionalRouteEffectPaso" ALTER COLUMN "modoProductividad" SET DEFAULT ''FIJA''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ProductoAdicionalNivel' AND column_name = 'modoProductividad') THEN
    EXECUTE 'ALTER TABLE "ProductoAdicionalNivel" ALTER COLUMN "modoProductividad" SET DEFAULT ''FIJA''';
  END IF;
END $$;
