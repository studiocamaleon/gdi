ALTER TABLE "ProductoServicio"
  ADD COLUMN "usarRutaComunVariantes" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "procesoDefinicionDefaultId" UUID;

ALTER TABLE "ProductoServicio"
  ADD CONSTRAINT "ProductoServicio_procesoDefinicionDefaultId_fkey"
  FOREIGN KEY ("procesoDefinicionDefaultId") REFERENCES "ProcesoDefinicion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProductoServicio_tenantId_procesoDefinicionDefaultId_idx"
  ON "ProductoServicio"("tenantId", "procesoDefinicionDefaultId");

-- Mantener comportamiento histórico en datos existentes:
-- si el producto ya tenía rutas en variantes, queda en modo por variante (OFF).
UPDATE "ProductoServicio" ps
SET "usarRutaComunVariantes" = false
WHERE EXISTS (
  SELECT 1
  FROM "ProductoVariante" pv
  WHERE pv."productoServicioId" = ps."id"
    AND pv."procesoDefinicionId" IS NOT NULL
);
