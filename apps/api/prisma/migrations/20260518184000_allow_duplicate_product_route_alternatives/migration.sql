ALTER TABLE "ProductoRutaAlternativa"
  DROP CONSTRAINT IF EXISTS "ProductoRutaAlternativa_tenantId_productoId_rutaId_key";

DROP INDEX IF EXISTS "ProductoRutaAlternativa_tenantId_productoId_rutaId_key";

CREATE INDEX IF NOT EXISTS "ProductoRutaAlternativa_tenantId_productoId_rutaId_idx"
  ON "ProductoRutaAlternativa"("tenantId", "productoId", "rutaId");
