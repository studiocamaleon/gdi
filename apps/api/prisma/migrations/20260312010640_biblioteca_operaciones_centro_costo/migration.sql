-- AlterTable
ALTER TABLE "ProcesoOperacionPlantilla" ADD COLUMN     "centroCostoId" UUID;

-- CreateIndex
CREATE INDEX "ProcesoOperacionPlantilla_tenantId_centroCostoId_idx" ON "ProcesoOperacionPlantilla"("tenantId", "centroCostoId");

-- AddForeignKey
ALTER TABLE "ProcesoOperacionPlantilla" ADD CONSTRAINT "ProcesoOperacionPlantilla_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
