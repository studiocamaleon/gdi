ALTER TABLE "ProductoConfigPasoMaquinaCandidata"
ADD COLUMN "perfilDefaultId" UUID;

CREATE INDEX "ProductoConfigPasoMaquinaCandidata_tenantId_perfilDefaul_idx"
ON "ProductoConfigPasoMaquinaCandidata"("tenantId", "perfilDefaultId");

ALTER TABLE "ProductoConfigPasoMaquinaCandidata"
ADD CONSTRAINT "ProductoConfigPasoMaquinaCandidata_perfilDefaultId_fkey"
FOREIGN KEY ("perfilDefaultId") REFERENCES "MaquinaPerfilOperativo"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
