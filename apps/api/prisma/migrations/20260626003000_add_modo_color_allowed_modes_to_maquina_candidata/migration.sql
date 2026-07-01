ALTER TABLE "ProductoConfigPasoMaquinaCandidata"
ADD COLUMN "modoColorAllowedModes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
