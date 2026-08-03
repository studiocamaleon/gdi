-- AlterTable
ALTER TABLE "MaquinaConsumible" ADD COLUMN     "consumoPorCoberturaJson" JSONB;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "coberturaDefault" TEXT;

-- Backfill (zero-regression): las 3 columnas de cobertura arrancan iguales al
-- consumoBase actual, así el costo no cambia hasta que el taller las diferencie.
UPDATE "MaquinaConsumible"
SET "consumoPorCoberturaJson" = jsonb_build_object(
  'borrador', "consumoBase",
  'normal',   "consumoBase",
  'alta',     "consumoBase")
WHERE "consumoBase" IS NOT NULL;
