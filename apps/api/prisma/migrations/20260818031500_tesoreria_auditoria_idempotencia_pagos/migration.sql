-- Segunda capa de integridad: auditoría de conciliación, fecha explícita del
-- débito de cheques propios e idempotencia de órdenes de pago.

ALTER TABLE "MovimientoFondos"
  ADD COLUMN IF NOT EXISTS "conciliadoEl" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "conciliadoPorId" UUID,
  ADD COLUMN IF NOT EXISTS "conciliadoPorNombre" TEXT;

ALTER TABLE "Valor"
  ADD COLUMN IF NOT EXISTS "debitadoEl" TIMESTAMP(3);

ALTER TABLE "Pago"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS "Pago_tenantId_idempotencyKey_key"
  ON "Pago"("tenantId", "idempotencyKey");
