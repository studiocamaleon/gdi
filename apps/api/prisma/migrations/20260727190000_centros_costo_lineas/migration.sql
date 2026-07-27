-- CreateEnum
CREATE TYPE "SeccionCentroCostoLinea" AS ENUM ('GASTO_GENERAL', 'EMPLEADO', 'ACTIVO_FIJO');

-- AlterTable
ALTER TABLE "CentroCostoCapacidadPeriodo" ADD COLUMN     "horasProductivas" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "CentroCostoLinea" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "centroCostoId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "seccion" "SeccionCentroCostoLinea" NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaComponenteCostoCentro",
    "ocupacion" TEXT,
    "horasMes" DECIMAL(10,2),
    "salarioMensual" DECIMAL(14,2),
    "cargasPct" DECIMAL(9,6),
    "vidaUtilRestanteMeses" INTEGER,
    "valorActual" DECIMAL(14,2),
    "valorFinalVida" DECIMAL(14,2),
    "importeMensual" DECIMAL(14,2) NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCostoLinea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CentroCostoLinea_tenantId_centroCostoId_periodo_idx" ON "CentroCostoLinea"("tenantId", "centroCostoId", "periodo");

-- CreateIndex
CREATE INDEX "CentroCostoLinea_tenantId_periodo_seccion_idx" ON "CentroCostoLinea"("tenantId", "periodo", "seccion");

-- AddForeignKey
ALTER TABLE "CentroCostoLinea" ADD CONSTRAINT "CentroCostoLinea_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CentroCostoLinea" ADD CONSTRAINT "CentroCostoLinea_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

