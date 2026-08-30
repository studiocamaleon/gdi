ALTER TABLE "GateProduccionDocumento"
  ADD COLUMN "ordenItemId" UUID,
  ADD COLUMN "recetaDocumentoId" UUID;

CREATE UNIQUE INDEX "GateProduccionDocumento_ordenItemId_recetaDocumentoId_key"
  ON "GateProduccionDocumento"("ordenItemId", "recetaDocumentoId");

CREATE INDEX "GateProduccionDocumento_tenantId_ordenItemId_activo_idx"
  ON "GateProduccionDocumento"("tenantId", "ordenItemId", "activo");

ALTER TABLE "GateProduccionDocumento"
  ADD CONSTRAINT "GateProduccionDocumento_ordenItemId_fkey"
  FOREIGN KEY ("ordenItemId") REFERENCES "OrdenTrabajoItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GateProduccionDocumento"
  ADD CONSTRAINT "GateProduccionDocumento_recetaDocumentoId_fkey"
  FOREIGN KEY ("recetaDocumentoId") REFERENCES "ProductoRecetaDocumento"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
