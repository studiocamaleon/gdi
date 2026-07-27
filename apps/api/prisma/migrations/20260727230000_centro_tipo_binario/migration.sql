-- Un centro produce lo que se vende, o es estructura que se reparte entre los
-- que producen. Los seis tipos anteriores decían lo mismo con más palabras, y
-- la imputación era un segundo campo que repetía la misma decisión.
--
-- El cast automático de Prisma no sirve acá: 'ADMINISTRATIVO' no existe en el
-- enum nuevo y la migración reventaría. La conversión se hace por la imputación,
-- que es el campo que hoy dice de verdad quién reparte su costo — y se hace
-- ANTES de borrar esa columna.
BEGIN;

CREATE TYPE "TipoCentroCosto_new" AS ENUM ('PRODUCTIVO', 'NO_PRODUCTIVO');

ALTER TABLE "CentroCosto"
  ALTER COLUMN "tipoCentro" TYPE "TipoCentroCosto_new"
  USING (
    CASE
      WHEN "imputacionPreferida" = 'REPARTO' THEN 'NO_PRODUCTIVO'
      ELSE 'PRODUCTIVO'
    END::"TipoCentroCosto_new"
  );

ALTER TYPE "TipoCentroCosto" RENAME TO "TipoCentroCosto_old";
ALTER TYPE "TipoCentroCosto_new" RENAME TO "TipoCentroCosto";
DROP TYPE "public"."TipoCentroCosto_old";

COMMIT;

-- La imputación queda implícita en el tipo, y la unidad no la leía nadie: su
-- único uso era filtrar qué centros se ofrecen al asignar un paso, y ese filtro
-- pasa a mirar el tipo.
ALTER TABLE "CentroCosto" DROP COLUMN "imputacionPreferida",
DROP COLUMN "unidadBaseFutura";

ALTER TABLE "CentroCostoCapacidadPeriodo" DROP COLUMN "unidadBase";

DROP TYPE "ImputacionPreferidaCentroCosto";

DROP TYPE "UnidadBaseCentroCosto";
