/*
  Warnings:

  - Added the required column `periodo` to the `CentroCostoRecurso` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CentroCostoRecurso_tenantId_centroCostoId_idx";

-- DropIndex
DROP INDEX "CentroCostoRecurso_tenantId_tipoRecurso_idx";

-- AlterTable
ALTER TABLE "CentroCostoComponenteCostoPeriodo" ADD COLUMN     "detalleJson" JSONB;

-- AlterTable
ALTER TABLE "CentroCostoRecurso" ADD COLUMN     "periodo" TEXT NOT NULL,
ADD COLUMN     "porcentajeAsignacion" DECIMAL(5,2);

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_centroCostoId_periodo_idx" ON "CentroCostoRecurso"("tenantId", "centroCostoId", "periodo");

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_tipoRecurso_periodo_idx" ON "CentroCostoRecurso"("tenantId", "tipoRecurso", "periodo");

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_empleadoId_periodo_idx" ON "CentroCostoRecurso"("tenantId", "empleadoId", "periodo");
