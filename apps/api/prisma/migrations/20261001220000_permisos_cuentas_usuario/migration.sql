ALTER TABLE "Membership"
  ADD COLUMN "cuentasRestringidas" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cuentasOperablesIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "cuentasDestinoIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
ALTER TABLE "CuentaFondosEvento" ADD COLUMN "idempotencyKey" UUID;
CREATE UNIQUE INDEX "CuentaFondosEvento_tenantId_idempotencyKey_key" ON "CuentaFondosEvento"("tenantId", "idempotencyKey");
