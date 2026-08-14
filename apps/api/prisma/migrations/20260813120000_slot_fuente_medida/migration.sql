-- Fuente de medida de consumo por SLOT (override del default a nivel paso).
-- docs/fuente-de-medida-de-consumo-diseno.md §6/§8. Aditivo, nullable.
ALTER TABLE "ProductoConfigPasoSlotMaterial" ADD COLUMN "fuenteMedida" TEXT;
