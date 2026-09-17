CREATE TYPE "EstructuraProducto" AS ENUM ('SIMPLE', 'COMPUESTO');

ALTER TABLE "Producto"
ADD COLUMN "estructuraProducto" "EstructuraProducto" NOT NULL DEFAULT 'SIMPLE';

ALTER TABLE "ProductoRecetaComponente"
ADD COLUMN "nodosPredecesoresClaves" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Compatibilidad: toda composición ya modelada conserva explícitamente su
-- semántica. Se consideran borradores, publicaciones y revisiones históricas.
UPDATE "Producto" AS producto
SET "estructuraProducto" = 'COMPUESTO'
WHERE EXISTS (
  SELECT 1
  FROM "ProductoReceta" AS receta
  INNER JOIN "ProductoRecetaRevision" AS revision
    ON revision."recetaId" = receta."id"
  INNER JOIN "ProductoRecetaComponente" AS componente
    ON componente."revisionId" = revision."id"
  WHERE receta."productoId" = producto."id"
);

CREATE INDEX "Producto_tenantId_estructuraProducto_idx"
ON "Producto"("tenantId", "estructuraProducto");
