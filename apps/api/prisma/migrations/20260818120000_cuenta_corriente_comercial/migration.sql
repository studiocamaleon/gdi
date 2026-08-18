-- Cuenta corriente comercial: plazo por cliente, vencimiento congelado por OT
-- y aplicaciones N:M de cobros a órdenes, separadas de las imputaciones fiscales.
ALTER TABLE "Cliente"
  ADD COLUMN "plazoCuentaCorrienteDias" INTEGER;

-- Hasta ahora el único indicio explícito de cuenta corriente era el límite de
-- crédito. Se conserva ese comportamiento con plazo 0; luego el usuario puede
-- configurar el plazo real desde la ficha del cliente.
UPDATE "Cliente"
SET "plazoCuentaCorrienteDias" = 0
WHERE "limiteCredito" IS NOT NULL;

ALTER TABLE "OrdenTrabajo"
  ADD COLUMN "fechaVencimientoComercial" DATE;

-- Los históricos mantienen exactamente el aging anterior.
UPDATE "OrdenTrabajo"
SET "fechaVencimientoComercial" = "fechaFinalizada"::date
WHERE "fechaFinalizada" IS NOT NULL;

CREATE TABLE "CobroOrden" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "cobroId" UUID NOT NULL,
  "ordenId" UUID NOT NULL,
  "monto" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CobroOrden_pkey" PRIMARY KEY ("id")
);

-- Los cobros históricos dirigidos a una OT ya eran, en los hechos, una
-- aplicación comercial completa. Se materializan sin cambiar sus saldos.
INSERT INTO "CobroOrden" (
  "id", "tenantId", "cobroId", "ordenId", "monto", "createdAt"
)
SELECT
  gen_random_uuid(), c."tenantId", c."id", c."ordenId", c."montoBruto", c."createdAt"
FROM "Cobro" c
WHERE c."ordenId" IS NOT NULL;

CREATE UNIQUE INDEX "CobroOrden_cobroId_ordenId_key"
  ON "CobroOrden"("cobroId", "ordenId");
CREATE INDEX "CobroOrden_tenantId_ordenId_idx"
  ON "CobroOrden"("tenantId", "ordenId");

ALTER TABLE "CobroOrden"
  ADD CONSTRAINT "CobroOrden_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CobroOrden"
  ADD CONSTRAINT "CobroOrden_cobroId_fkey"
  FOREIGN KEY ("cobroId") REFERENCES "Cobro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CobroOrden"
  ADD CONSTRAINT "CobroOrden_ordenId_fkey"
  FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
