-- Prueba con vencimiento + variante anual de cada plan.
ALTER TABLE "Plan" ADD COLUMN "paddlePriceIdAnual" TEXT;
ALTER TABLE "Plan" ADD COLUMN "precioAnual" DECIMAL(14,2);
ALTER TABLE "Plan" ADD COLUMN "trialDias" INTEGER;
CREATE UNIQUE INDEX "Plan_paddlePriceIdAnual_key" ON "Plan"("paddlePriceIdAnual");

ALTER TABLE "Suscripcion" ADD COLUMN "trialHasta" TIMESTAMP(3);
CREATE INDEX "Suscripcion_trialHasta_idx" ON "Suscripcion"("trialHasta");
