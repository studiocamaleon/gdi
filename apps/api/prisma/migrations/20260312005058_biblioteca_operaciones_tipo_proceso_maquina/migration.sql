/*
  Warnings:

  - You are about to drop the column `plantillaMaquinaria` on the `ProcesoOperacionPlantilla` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ProcesoOperacionPlantilla_tenantId_plantillaMaquinaria_idx";

-- AlterTable
ALTER TABLE "ProcesoOperacionPlantilla" DROP COLUMN "plantillaMaquinaria",
ADD COLUMN     "maquinaId" UUID,
ADD COLUMN     "perfilOperativoId" UUID,
ADD COLUMN     "tipoProceso" "TipoProceso" NOT NULL DEFAULT 'MAQUINARIA',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "ProcesoOperacionPlantilla_tenantId_tipoProceso_idx" ON "ProcesoOperacionPlantilla"("tenantId", "tipoProceso");

-- CreateIndex
CREATE INDEX "ProcesoOperacionPlantilla_tenantId_maquinaId_idx" ON "ProcesoOperacionPlantilla"("tenantId", "maquinaId");

-- CreateIndex
CREATE INDEX "ProcesoOperacionPlantilla_tenantId_perfilOperativoId_idx" ON "ProcesoOperacionPlantilla"("tenantId", "perfilOperativoId");

-- AddForeignKey
ALTER TABLE "ProcesoOperacionPlantilla" ADD CONSTRAINT "ProcesoOperacionPlantilla_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcesoOperacionPlantilla" ADD CONSTRAINT "ProcesoOperacionPlantilla_perfilOperativoId_fkey" FOREIGN KEY ("perfilOperativoId") REFERENCES "MaquinaPerfilOperativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
