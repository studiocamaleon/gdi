-- CreateEnum
CREATE TYPE "RolProcesoOperacion" AS ENUM ('IMPRESION');

-- AlterTable: ProcesoOperacion
ALTER TABLE "ProcesoOperacion" ADD COLUMN "rol" "RolProcesoOperacion";
ALTER TABLE "ProcesoOperacion" ADD COLUMN "esOpcional" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: ProcesoOperacionPlantilla
ALTER TABLE "ProcesoOperacionPlantilla" ADD COLUMN "rol" "RolProcesoOperacion";
ALTER TABLE "ProcesoOperacionPlantilla" ADD COLUMN "esOpcional" BOOLEAN NOT NULL DEFAULT false;
