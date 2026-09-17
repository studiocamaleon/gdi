ALTER TABLE "ProductoRecetaComponente"
  ADD COLUMN "recetaRevisionId" UUID,
  ADD COLUMN "recetaVersion" INTEGER,
  ADD COLUMN "recetaHuella" VARCHAR(64);

UPDATE "ProductoRecetaComponente" componente
SET
  "recetaRevisionId" = receta."revisionPublicadaId",
  "recetaVersion" = revision."numero",
  "recetaHuella" = revision."huellaConfiguracion"
FROM "ProductoReceta" receta
JOIN "ProductoRecetaRevision" revision
  ON revision."id" = receta."revisionPublicadaId"
WHERE receta."productoId" = componente."productoComponenteId"
  AND receta."tenantId" = componente."tenantId";

DELETE FROM "ProductoRecetaComponente"
WHERE "recetaRevisionId" IS NULL;

ALTER TABLE "ProductoRecetaComponente"
  ALTER COLUMN "recetaRevisionId" SET NOT NULL,
  ALTER COLUMN "recetaVersion" SET NOT NULL,
  ALTER COLUMN "recetaHuella" SET NOT NULL;

CREATE INDEX "ProductoRecetaComponente_tenantId_recetaRevisionId_idx"
  ON "ProductoRecetaComponente"("tenantId", "recetaRevisionId");
