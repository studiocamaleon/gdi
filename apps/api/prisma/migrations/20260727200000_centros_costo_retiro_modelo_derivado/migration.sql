-- DropForeignKey
ALTER TABLE "CentroCosto" DROP CONSTRAINT "CentroCosto_areaCostoId_fkey";

-- DropForeignKey
ALTER TABLE "CentroCosto" DROP CONSTRAINT "CentroCosto_responsableEmpleadoId_fkey";

-- DropForeignKey
ALTER TABLE "CentroCostoComponenteCostoPeriodo" DROP CONSTRAINT "CentroCostoComponenteCostoPeriodo_centroCostoId_fkey";

-- DropForeignKey
ALTER TABLE "CentroCostoComponenteCostoPeriodo" DROP CONSTRAINT "CentroCostoComponenteCostoPeriodo_empleadoId_fkey";

-- DropForeignKey
ALTER TABLE "CentroCostoComponenteCostoPeriodo" DROP CONSTRAINT "CentroCostoComponenteCostoPeriodo_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CentroCostoRecurso" DROP CONSTRAINT "CentroCostoRecurso_centroCostoId_fkey";

-- DropForeignKey
ALTER TABLE "CentroCostoRecurso" DROP CONSTRAINT "CentroCostoRecurso_empleadoId_fkey";

-- DropForeignKey
ALTER TABLE "CentroCostoRecurso" DROP CONSTRAINT "CentroCostoRecurso_maquinaId_fkey";

-- DropForeignKey
ALTER TABLE "CentroCostoRecurso" DROP CONSTRAINT "CentroCostoRecurso_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CentroCostoRecursoMaquinaPeriodo" DROP CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_centroCostoRecursoId_fkey";

-- DropForeignKey
ALTER TABLE "CentroCostoRecursoMaquinaPeriodo" DROP CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_maquinaId_fkey";

-- DropForeignKey
ALTER TABLE "CentroCostoRecursoMaquinaPeriodo" DROP CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_tenantId_fkey";

-- DropIndex
DROP INDEX "CentroCosto_tenantId_plantaId_areaCostoId_idx";

-- AlterTable
ALTER TABLE "CentroCosto" DROP COLUMN "areaCostoId",
DROP COLUMN "categoriaGrafica",
DROP COLUMN "responsableEmpleadoId";

-- AlterTable
ALTER TABLE "CentroCostoCapacidadPeriodo" DROP COLUMN "capacidadPractica",
DROP COLUMN "capacidadTeorica",
DROP COLUMN "diasPorMes",
DROP COLUMN "horasPorDia",
DROP COLUMN "overrideManualCapacidad",
DROP COLUMN "porcentajeNoProductivo",
ALTER COLUMN "horasProductivas" SET NOT NULL;

-- DropTable
DROP TABLE "CentroCostoComponenteCostoPeriodo";

-- DropTable
DROP TABLE "CentroCostoRecurso";

-- DropTable
DROP TABLE "CentroCostoRecursoMaquinaPeriodo";

-- DropEnum
DROP TYPE "CategoriaGraficaCentroCosto";

-- DropEnum
DROP TYPE "OrigenComponenteCostoCentro";

-- DropEnum
DROP TYPE "TipoGastoGeneralCentroCosto";

-- DropEnum
DROP TYPE "TipoRecursoCentroCosto";

-- CreateIndex
CREATE INDEX "CentroCosto_tenantId_plantaId_idx" ON "CentroCosto"("tenantId", "plantaId");

