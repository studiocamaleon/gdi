ALTER TABLE "OrdenTrabajo"
ADD COLUMN "idempotencyKey" UUID;

CREATE UNIQUE INDEX "OrdenTrabajo_tenantId_idempotencyKey_key"
ON "OrdenTrabajo"("tenantId", "idempotencyKey");
