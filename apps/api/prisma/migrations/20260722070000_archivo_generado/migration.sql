-- Distingue lo que produce el sistema (PDF de presupuesto, de comprobante) de
-- lo que sube una persona. Los generados no aparecen en el tab de archivos, no
-- se re-vinculan al convertir y no se borran a mano.
-- Ver docs/archivos-r2-diseno.md §5 (F3).

ALTER TABLE "Archivo" ADD COLUMN "generado" BOOLEAN NOT NULL DEFAULT false;

-- El endpoint de PDF busca "el generado de esta entidad": conviene indexado.
CREATE INDEX "Archivo_tenantId_scope_generado_idx"
  ON "Archivo"("tenantId", "scope", "generado");
