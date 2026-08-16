-- Un cliente identificado no puede duplicarse dentro de una empresa.
-- PostgreSQL permite múltiples NULL en índices únicos, por lo que los clientes
-- todavía no identificados siguen siendo válidos.
CREATE UNIQUE INDEX "Cliente_tenantId_documentoNumero_key"
  ON "Cliente"("tenantId", "documentoNumero");

CREATE UNIQUE INDEX "Cliente_tenantId_cuit_key"
  ON "Cliente"("tenantId", "cuit");

-- El historial comercial y los archivos deben impedir el borrado físico.
-- Inhabilitar es la operación correcta cuando el cliente ya tuvo actividad.
ALTER TABLE "Cotizacion"
  DROP CONSTRAINT IF EXISTS "Cotizacion_clienteId_fkey",
  ADD CONSTRAINT "Cotizacion_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrdenTrabajo"
  DROP CONSTRAINT IF EXISTS "OrdenTrabajo_clienteId_fkey",
  ADD CONSTRAINT "OrdenTrabajo_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Cobro"
  DROP CONSTRAINT IF EXISTS "Cobro_clienteId_fkey",
  ADD CONSTRAINT "Cobro_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Valor"
  DROP CONSTRAINT IF EXISTS "Valor_clienteId_fkey",
  ADD CONSTRAINT "Valor_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Comprobante"
  DROP CONSTRAINT IF EXISTS "Comprobante_clienteId_fkey",
  ADD CONSTRAINT "Comprobante_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Archivo"
  DROP CONSTRAINT IF EXISTS "Archivo_clienteId_fkey",
  ADD CONSTRAINT "Archivo_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
