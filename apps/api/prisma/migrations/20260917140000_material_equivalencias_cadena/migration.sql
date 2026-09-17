-- Preserva cantidades, costos e históricos. Uso hereda la antigua base de costeo.
ALTER TYPE "UnidadMateriaPrima" ADD VALUE IF NOT EXISTS 'PALLET';
ALTER TABLE "MateriaPrima" ADD COLUMN "unidadUso" "UnidadMateriaPrima";
ALTER TABLE "MateriaPrimaVariante" ADD COLUMN "unidadUso" "UnidadMateriaPrima", ADD COLUMN "equivalenciasJson" JSONB;
UPDATE "MateriaPrima" SET "unidadUso" = "unidadStock";
UPDATE "MateriaPrimaVariante" SET "unidadUso" = "unidadStock" WHERE "unidadStock" IS NOT NULL;
-- El factor legado sigue legible; la lista nueva toma precedencia al editarla.
ALTER TABLE "MovimientoStockMateriaPrima" ADD COLUMN "conversionSnapshotJson" JSONB,
  ALTER COLUMN "cantidad" TYPE DECIMAL(20,8), ALTER COLUMN "saldoPosterior" TYPE DECIMAL(20,8);
ALTER TABLE "StockMateriaPrimaVariante" ALTER COLUMN "cantidadDisponible" TYPE DECIMAL(20,8);
