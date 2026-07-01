CREATE TYPE "ModoMedidasProducto" AS ENUM ('FIJA', 'LIBRE', 'COMERCIAL_ELIGE', 'MIXTA');

UPDATE "Producto"
SET "modoMedidas" = 'FIJA'
WHERE "modoMedidas" IS NULL
   OR "modoMedidas" NOT IN ('FIJA', 'LIBRE', 'COMERCIAL_ELIGE', 'MIXTA');

ALTER TABLE "Producto"
ALTER COLUMN "modoMedidas" DROP DEFAULT,
ALTER COLUMN "modoMedidas" TYPE "ModoMedidasProducto"
USING "modoMedidas"::"ModoMedidasProducto",
ALTER COLUMN "modoMedidas" SET DEFAULT 'FIJA';
