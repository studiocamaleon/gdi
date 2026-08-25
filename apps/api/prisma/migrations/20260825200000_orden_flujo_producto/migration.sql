ALTER TABLE "ProductoConfigPaso" ADD COLUMN "ordenFlujo" INTEGER;
ALTER TABLE "ProductoPasoExtra" ADD COLUMN "ordenFlujo" INTEGER;

CREATE INDEX "ProductoConfigPaso_productoRutaAlternativaId_ordenFlujo_idx"
  ON "ProductoConfigPaso"("productoRutaAlternativaId", "ordenFlujo");
CREATE INDEX "ProductoPasoExtra_rutaAlternativaId_ordenFlujo_idx"
  ON "ProductoPasoExtra"("rutaAlternativaId", "ordenFlujo");
