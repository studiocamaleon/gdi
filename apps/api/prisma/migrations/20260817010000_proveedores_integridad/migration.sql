ALTER TABLE "Proveedor"
  ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Proveedor_tenantId_cuit_key"
  ON "Proveedor"("tenantId", "cuit");

CREATE INDEX "Proveedor_tenantId_activo_idx"
  ON "Proveedor"("tenantId", "activo");

-- Un proveedor con actividad se inhabilita: nunca se borra perdiendo la
-- identidad de facturas, pagos, cheques, materiales o tercerizaciones.
ALTER TABLE "Valor"
  DROP CONSTRAINT IF EXISTS "Valor_proveedorId_fkey",
  ADD CONSTRAINT "Valor_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductoConfigPaso"
  DROP CONSTRAINT IF EXISTS "ProductoConfigPaso_proveedorId_fkey",
  ADD CONSTRAINT "ProductoConfigPaso_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Archivo"
  DROP CONSTRAINT IF EXISTS "Archivo_proveedorId_fkey",
  ADD CONSTRAINT "Archivo_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MateriaPrimaVariante"
  DROP CONSTRAINT IF EXISTS "MateriaPrimaVariante_proveedorReferenciaId_fkey",
  ADD CONSTRAINT "MateriaPrimaVariante_proveedorReferenciaId_fkey"
    FOREIGN KEY ("proveedorReferenciaId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Egreso"
  DROP CONSTRAINT IF EXISTS "Egreso_proveedorId_fkey",
  ADD CONSTRAINT "Egreso_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Pago"
  DROP CONSTRAINT IF EXISTS "Pago_proveedorId_fkey",
  ADD CONSTRAINT "Pago_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GastoRecurrente"
  DROP CONSTRAINT IF EXISTS "GastoRecurrente_proveedorId_fkey",
  ADD CONSTRAINT "GastoRecurrente_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GastoFijoEstructura"
  DROP CONSTRAINT IF EXISTS "GastoFijoEstructura_proveedorId_fkey",
  ADD CONSTRAINT "GastoFijoEstructura_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FamiliaPasoDefaults"
  DROP CONSTRAINT IF EXISTS "FamiliaPasoDefaults_proveedorId_fkey",
  ADD CONSTRAINT "FamiliaPasoDefaults_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PasoTenant"
  DROP CONSTRAINT IF EXISTS "PasoTenant_proveedorId_fkey",
  ADD CONSTRAINT "PasoTenant_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
