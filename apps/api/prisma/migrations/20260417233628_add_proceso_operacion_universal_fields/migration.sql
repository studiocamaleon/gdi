-- Modelo universal (A.3) — extensiones aditivas a ProcesoOperacion.
-- Todas las columnas son nullable; motores v1 las ignoran, motores v2
-- de etapas posteriores las consumirán. Migración reversible vía DROP COLUMN.

-- CreateEnum
CREATE TYPE "ActivacionPasoV2" AS ENUM ('OBLIGATORIO', 'OPCIONAL', 'CONDICIONAL');

-- AlterTable: agregar columnas de modelo universal
ALTER TABLE "ProcesoOperacion"
  ADD COLUMN "familiaV2"          TEXT,
  ADD COLUMN "leeDelTrabajoV2"    JSONB,
  ADD COLUMN "leeDePasosV2"       JSONB,
  ADD COLUMN "produceV2"          JSONB,
  ADD COLUMN "unidadProductivaV2" TEXT,
  ADD COLUMN "activacionV2"       "ActivacionPasoV2",
  ADD COLUMN "condicionV2"        JSONB;
