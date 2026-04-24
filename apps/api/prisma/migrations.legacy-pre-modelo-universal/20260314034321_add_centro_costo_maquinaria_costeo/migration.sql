-- CreateEnum
CREATE TYPE "MetodoDepreciacionMaquina" AS ENUM ('LINEAL');

-- AlterTable
ALTER TABLE "CentroCostoRecurso" ADD COLUMN     "maquinaId" UUID;

-- CreateTable
CREATE TABLE "CentroCostoRecursoMaquinaPeriodo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoRecursoId" UUID NOT NULL,
    "maquinaId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "metodoDepreciacion" "MetodoDepreciacionMaquina" NOT NULL DEFAULT 'LINEAL',
    "valorCompra" DECIMAL(14,2) NOT NULL,
    "valorResidual" DECIMAL(14,2) NOT NULL,
    "vidaUtilMeses" INTEGER NOT NULL,
    "potenciaNominalKw" DECIMAL(10,4) NOT NULL,
    "factorCargaPct" DECIMAL(5,2) NOT NULL,
    "tarifaEnergiaKwh" DECIMAL(12,4) NOT NULL,
    "horasProgramadasMes" DECIMAL(10,2) NOT NULL,
    "disponibilidadPct" DECIMAL(5,2) NOT NULL,
    "eficienciaPct" DECIMAL(5,2) NOT NULL,
    "mantenimientoMensual" DECIMAL(14,2) NOT NULL,
    "segurosMensual" DECIMAL(14,2) NOT NULL,
    "otrosFijosMensual" DECIMAL(14,2) NOT NULL,
    "amortizacionMensualCalc" DECIMAL(14,2) NOT NULL,
    "energiaMensualCalc" DECIMAL(14,2) NOT NULL,
    "costoMensualTotalCalc" DECIMAL(14,2) NOT NULL,
    "tarifaHoraCalc" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CentroCostoRecursoMaquinaPeriodo_tenantId_maquinaId_periodo_idx" ON "CentroCostoRecursoMaquinaPeriodo"("tenantId", "maquinaId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCostoRecursoMaquinaPeriodo_tenantId_centroCostoRecurs_key" ON "CentroCostoRecursoMaquinaPeriodo"("tenantId", "centroCostoRecursoId", "periodo");

-- CreateIndex
CREATE INDEX "CentroCostoRecurso_tenantId_maquinaId_periodo_idx" ON "CentroCostoRecurso"("tenantId", "maquinaId", "periodo");

-- AddForeignKey
ALTER TABLE "CentroCostoRecurso" ADD CONSTRAINT "CentroCostoRecurso_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoRecursoMaquinaPeriodo" ADD CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoRecursoMaquinaPeriodo" ADD CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_centroCostoRecursoId_fkey" FOREIGN KEY ("centroCostoRecursoId") REFERENCES "CentroCostoRecurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoRecursoMaquinaPeriodo" ADD CONSTRAINT "CentroCostoRecursoMaquinaPeriodo_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE;
