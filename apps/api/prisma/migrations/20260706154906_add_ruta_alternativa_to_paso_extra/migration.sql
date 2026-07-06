-- AlterTable
ALTER TABLE "ProductoPasoExtra" ADD COLUMN     "rutaAlternativaId" UUID;

-- CreateIndex
CREATE INDEX "ProductoPasoExtra_tenantId_rutaAlternativaId_activo_idx" ON "ProductoPasoExtra"("tenantId", "rutaAlternativaId", "activo");

-- AddForeignKey
ALTER TABLE "ProductoPasoExtra" ADD CONSTRAINT "ProductoPasoExtra_rutaAlternativaId_fkey" FOREIGN KEY ("rutaAlternativaId") REFERENCES "ProductoRutaAlternativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
