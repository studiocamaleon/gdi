-- Transferencias entre cuentas de distinta moneda: se registra el tipo de
-- cambio implícito (moneda destino por 1 de origen). Antes el mismo número
-- se debitaba y acreditaba sin convertir, con una UI que prometía lo
-- contrario. Ver docs/multi-moneda-zona-horaria-diseno.md §F4.
ALTER TABLE "MovimientoFondos" ADD COLUMN "tipoCambio" DECIMAL(14,4);
