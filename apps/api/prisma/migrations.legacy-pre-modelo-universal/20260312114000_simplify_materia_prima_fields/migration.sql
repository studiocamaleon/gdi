-- Simplifica campos tecnicos no requeridos para Materia Prima
ALTER TABLE "MateriaPrima"
  DROP COLUMN IF EXISTS "templateVersion",
  DROP COLUMN IF EXISTS "factorConversionCompra",
  DROP COLUMN IF EXISTS "controlLote",
  DROP COLUMN IF EXISTS "controlVencimiento";

ALTER TABLE "MateriaPrimaVariante"
  DROP COLUMN IF EXISTS "factorConversionCompra";
