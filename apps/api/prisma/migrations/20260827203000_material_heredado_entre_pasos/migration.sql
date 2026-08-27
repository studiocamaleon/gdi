ALTER TABLE "ProductoConfigPasoSlotMaterial"
  ADD COLUMN "heredaDeRutaPasoId" UUID,
  ADD COLUMN "heredaDeSlotCodigo" TEXT;

CREATE INDEX "ProductoConfigPasoSlotMaterial_tenantId_heredaDeRutaPasoId_idx"
  ON "ProductoConfigPasoSlotMaterial"("tenantId", "heredaDeRutaPasoId");
