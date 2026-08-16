CREATE TABLE "ClienteEvento" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "clienteId" UUID NOT NULL,
  "tipo" VARCHAR(40) NOT NULL,
  "actorId" UUID,
  "actorNombre" TEXT,
  "detalle" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClienteEvento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClienteEvento_tenantId_clienteId_createdAt_idx"
  ON "ClienteEvento"("tenantId", "clienteId", "createdAt");

ALTER TABLE "ClienteEvento"
  ADD CONSTRAINT "ClienteEvento_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ClienteEvento_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
