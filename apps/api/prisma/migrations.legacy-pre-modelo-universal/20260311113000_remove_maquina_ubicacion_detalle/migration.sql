-- Remove non-technical location detail from maquinaria model
ALTER TABLE "Maquina"
DROP COLUMN "ubicacionDetalle";
