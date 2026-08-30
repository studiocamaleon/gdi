-- Una receta publicada gobierna una vía de fabricación concreta. Esto permite
-- que un producto con rutas alternativas publique/evolucione cada BOM sin
-- invalidar las demás.
ALTER TABLE "ProductoReceta" ADD COLUMN "rutaAlternativaId" UUID;

-- Compatibilidad defensiva para una instalación que hubiera alcanzado a crear
-- borradores entre ambas migraciones del mismo release.
UPDATE "ProductoReceta" receta
SET "rutaAlternativaId" = revision."rutaAlternativaId"
FROM "ProductoRecetaRevision" revision
WHERE revision."recetaId" = receta."id"
  AND receta."rutaAlternativaId" IS NULL;

ALTER TABLE "ProductoReceta" ALTER COLUMN "rutaAlternativaId" SET NOT NULL;
DROP INDEX "ProductoReceta_productoId_key";
CREATE UNIQUE INDEX "ProductoReceta_tenantId_productoId_rutaAlternativaId_key"
  ON "ProductoReceta"("tenantId", "productoId", "rutaAlternativaId");
ALTER TABLE "ProductoReceta"
  ADD CONSTRAINT "ProductoReceta_rutaAlternativaId_fkey"
  FOREIGN KEY ("rutaAlternativaId") REFERENCES "ProductoRutaAlternativa"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
