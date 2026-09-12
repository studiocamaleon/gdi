-- AlterTable
ALTER TABLE "PlanEntregaItem" ADD COLUMN     "cotizacionItemId" UUID,
ALTER COLUMN "ordenItemId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PlanEntregaItem_cotizacionItemId_key" ON "PlanEntregaItem"("cotizacionItemId");

-- AddForeignKey
ALTER TABLE "PlanEntregaItem" ADD CONSTRAINT "PlanEntregaItem_cotizacionItemId_fkey" FOREIGN KEY ("cotizacionItemId") REFERENCES "CotizacionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "PlanEntregaItem" ADD CONSTRAINT "PlanEntregaItem_origen_check" CHECK ("ordenItemId" IS NOT NULL OR "cotizacionItemId" IS NOT NULL);
