ALTER TABLE "MetaVinculo"
  ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'COEXISTENCIA',
  ADD COLUMN "pruebaDestinatarioWaId" TEXT;

ALTER TABLE "MetaVinculo" ADD CONSTRAINT "MetaVinculo_tipo_prueba_check" CHECK (
  ("tipo" = 'COEXISTENCIA' AND "pruebaDestinatarioWaId" IS NULL)
  OR ("tipo" = 'PRUEBA' AND "pruebaDestinatarioWaId" IS NOT NULL
      AND "pruebaDestinatarioWaId" ~ '^[1-9][0-9]{7,14}$'
      AND "tokenVenceEl" IS NOT NULL)
);
