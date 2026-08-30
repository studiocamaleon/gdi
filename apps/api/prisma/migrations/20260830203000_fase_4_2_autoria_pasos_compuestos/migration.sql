CREATE TYPE "TipoPasoTenant" AS ENUM ('SIMPLE', 'COMPUESTO');

ALTER TABLE "PasoTenant"
ADD COLUMN "tipoPaso" "TipoPasoTenant" NOT NULL DEFAULT 'SIMPLE',
ADD COLUMN "operacionesCompuestasJson" JSONB;

ALTER TABLE "ProductoRecetaRevision"
ADD COLUMN "pasosCompuestosJson" JSONB;
