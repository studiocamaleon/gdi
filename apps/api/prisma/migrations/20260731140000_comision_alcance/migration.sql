-- Fase A de Comisiones: `alcance` en el catálogo de comisiones (espejo del de
-- impuestos). PRODUCTO (default) = comisión por producto (vendedor). TENANT =
-- aplica a toda cotización sin tildar (comisión de pasarela de pago: es de
-- "cómo te pagan", no del producto).
--
-- Default PRODUCTO ⇒ las comisiones existentes conservan su comportamiento
-- exacto. Cero cambio para lo que ya está cargado. Ver
-- docs/comisiones-modelo-diseno.md.

ALTER TABLE "ProductoComisionCatalogo"
  ADD COLUMN "alcance" TEXT NOT NULL DEFAULT 'PRODUCTO';

CREATE INDEX "ProductoComisionCatalogo_tenantId_alcance_activo_idx"
  ON "ProductoComisionCatalogo" ("tenantId", "alcance", "activo");
