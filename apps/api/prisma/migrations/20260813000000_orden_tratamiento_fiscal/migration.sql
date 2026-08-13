-- Tratamiento fiscal de la orden: FISCAL (default) | SIN_COMPROBANTE.
-- Aditivo y no destructivo: columna con default, todas las órdenes existentes
-- quedan FISCAL. Ver docs/margen-y-decisiones-de-precio.md §6.
ALTER TABLE "OrdenTrabajo"
  ADD COLUMN "tratamientoFiscal" TEXT NOT NULL DEFAULT 'FISCAL';
