-- Fase C — Herencia plantilla→paso.
-- Agrega la FK opcional `plantillaOrigenId` en ProcesoOperacion para que el
-- motor pueda usar los valores declarados en la plantilla cuando los
-- campos locales (productividadBase, setupMin, cleanupMin, tiempoFijoMin,
-- unidadTiempo, etc.) están en null.

ALTER TABLE "ProcesoOperacion"
  ADD COLUMN "plantillaOrigenId" UUID;

ALTER TABLE "ProcesoOperacion"
  ADD CONSTRAINT "ProcesoOperacion_plantillaOrigenId_fkey"
  FOREIGN KEY ("plantillaOrigenId")
  REFERENCES "ProcesoOperacionPlantilla"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProcesoOperacion_tenantId_plantillaOrigenId_idx"
  ON "ProcesoOperacion" ("tenantId", "plantillaOrigenId");
