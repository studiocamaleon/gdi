ALTER TABLE "ProductoConfigPaso"
  ADD COLUMN "centroCostoId" UUID;

ALTER TABLE "ProductoConfigPaso"
  ADD CONSTRAINT "ProductoConfigPaso_centroCostoId_fkey"
  FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProductoConfigPaso_tenantId_centroCostoId_idx"
  ON "ProductoConfigPaso"("tenantId", "centroCostoId");
