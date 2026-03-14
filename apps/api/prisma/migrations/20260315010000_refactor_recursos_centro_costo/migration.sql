CREATE TYPE "TipoGastoGeneralCentroCosto" AS ENUM ('LIMPIEZA', 'MANTENIMIENTO', 'SERVICIOS', 'ALQUILER', 'OTRO');

CREATE TYPE "TipoRecursoCentroCosto_new" AS ENUM ('EMPLEADO', 'MAQUINARIA', 'GASTO_GENERAL', 'ACTIVO_FIJO');

DELETE FROM "CentroCostoRecursoMaquinaPeriodo";
DELETE FROM "CentroCostoRecurso";

ALTER TABLE "CentroCosto" DROP CONSTRAINT IF EXISTS "CentroCosto_proveedorDefaultId_fkey";
ALTER TABLE "CentroCostoRecurso" DROP CONSTRAINT IF EXISTS "CentroCostoRecurso_proveedorId_fkey";

ALTER TABLE "CentroCostoRecurso"
  ALTER COLUMN "tipoRecurso" TYPE "TipoRecursoCentroCosto_new"
  USING (
    CASE
      WHEN "tipoRecurso" = 'EMPLEADO' THEN 'EMPLEADO'
      WHEN "tipoRecurso" = 'MAQUINARIA' THEN 'MAQUINARIA'
      WHEN "tipoRecurso" IN ('PROVEEDOR', 'GASTO_MANUAL') THEN 'GASTO_GENERAL'
      ELSE 'GASTO_GENERAL'
    END
  )::"TipoRecursoCentroCosto_new";

ALTER TYPE "TipoRecursoCentroCosto" RENAME TO "TipoRecursoCentroCosto_old";
ALTER TYPE "TipoRecursoCentroCosto_new" RENAME TO "TipoRecursoCentroCosto";
DROP TYPE "TipoRecursoCentroCosto_old";

ALTER TABLE "CentroCosto" DROP COLUMN IF EXISTS "proveedorDefaultId";

ALTER TABLE "CentroCostoRecurso"
  DROP COLUMN IF EXISTS "proveedorId",
  DROP COLUMN IF EXISTS "nombreManual",
  ADD COLUMN "nombreRecurso" TEXT,
  ADD COLUMN "tipoGastoGeneral" "TipoGastoGeneralCentroCosto",
  ADD COLUMN "valorMensual" DECIMAL(14, 2),
  ADD COLUMN "vidaUtilRestanteMeses" INTEGER,
  ADD COLUMN "valorActual" DECIMAL(14, 2),
  ADD COLUMN "valorFinalVida" DECIMAL(14, 2),
  ADD COLUMN "depreciacionMensualCalc" DECIMAL(14, 2);
