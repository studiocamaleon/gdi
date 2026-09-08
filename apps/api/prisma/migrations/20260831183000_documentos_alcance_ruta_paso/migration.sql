-- Los requisitos documentales dejan de inferir su alcance exclusivamente por
-- pasoId. ITEM permite que un componente bloquee su propia subruta sin frenar
-- las ramas independientes ni toda la OT padre.

CREATE TYPE "AlcanceDocumentoProduccion" AS ENUM ('ORDEN', 'ITEM', 'PASO');

ALTER TABLE "ProductoRecetaDocumento"
  ADD COLUMN "alcance" "AlcanceDocumentoProduccion" NOT NULL DEFAULT 'ITEM';

-- Compatibilidad: la UI anterior llamaba "Toda la orden" a todo requisito sin
-- paso. Los nuevos requisitos generales usarán ITEM de forma predeterminada.
UPDATE "ProductoRecetaDocumento"
SET "alcance" = CASE
  WHEN "pasoClave" IS NOT NULL THEN 'PASO'::"AlcanceDocumentoProduccion"
  ELSE 'ORDEN'::"AlcanceDocumentoProduccion"
END;

ALTER TABLE "GateProduccionDocumento"
  ADD COLUMN "alcance" "AlcanceDocumentoProduccion" NOT NULL DEFAULT 'ORDEN';

UPDATE "GateProduccionDocumento" AS gate
SET "alcance" = CASE
  WHEN gate."pasoId" IS NOT NULL THEN 'PASO'::"AlcanceDocumentoProduccion"
  WHEN requisito."alcance" = 'ITEM'::"AlcanceDocumentoProduccion"
    THEN 'ITEM'::"AlcanceDocumentoProduccion"
  ELSE 'ORDEN'::"AlcanceDocumentoProduccion"
END
FROM "ProductoRecetaDocumento" AS requisito
WHERE gate."recetaDocumentoId" = requisito."id";
