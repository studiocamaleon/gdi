-- Sub-productos (productos componentes) en ProcesoOperacionMaterial.
-- Un material de un paso ahora puede ser, en vez de una MateriaPrimaVariante
-- del catálogo, otra instancia de ProductoServicio completa que se cotiza
-- recursivamente con el super motor.

ALTER TABLE "ProcesoOperacionMaterial"
  ADD COLUMN "productoComponenteId" UUID,
  ADD COLUMN "varianteComponenteId" UUID;

ALTER TABLE "ProcesoOperacionMaterial"
  ADD CONSTRAINT "ProcesoOperacionMaterial_productoComponenteId_fkey"
  FOREIGN KEY ("productoComponenteId")
  REFERENCES "ProductoServicio"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacionMaterial"
  ADD CONSTRAINT "ProcesoOperacionMaterial_varianteComponenteId_fkey"
  FOREIGN KEY ("varianteComponenteId")
  REFERENCES "ProductoVariante"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProcesoOperacionMaterial_tenantId_productoComponenteId_idx"
  ON "ProcesoOperacionMaterial"("tenantId", "productoComponenteId");

CREATE INDEX "ProcesoOperacionMaterial_tenantId_varianteComponenteId_idx"
  ON "ProcesoOperacionMaterial"("tenantId", "varianteComponenteId");
