ALTER TABLE "CotizacionProductoSnapshot"
  ADD COLUMN "productoServicioId" UUID;

UPDATE "CotizacionProductoSnapshot" cps
SET "productoServicioId" = pv."productoServicioId"
FROM "ProductoVariante" pv
WHERE cps."productoVarianteId" = pv."id"
  AND cps."productoServicioId" IS NULL;

ALTER TABLE "CotizacionProductoSnapshot"
  ALTER COLUMN "productoVarianteId" DROP NOT NULL;

ALTER TABLE "CotizacionProductoSnapshot"
  ADD CONSTRAINT "CotizacionProductoSnapshot_productoServicioId_fkey"
  FOREIGN KEY ("productoServicioId") REFERENCES "ProductoServicio"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CotizacionProductoSnapshot_tenantId_productoServicioId_createdAt_idx"
  ON "CotizacionProductoSnapshot"("tenantId", "productoServicioId", "createdAt");
