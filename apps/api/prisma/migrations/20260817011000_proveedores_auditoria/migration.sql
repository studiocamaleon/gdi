CREATE TABLE "ProveedorEvento" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "proveedorId" UUID NOT NULL,
  "tipo" VARCHAR(40) NOT NULL,
  "actorId" UUID,
  "actorNombre" TEXT,
  "detalle" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProveedorEvento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProveedorEvento_tenantId_proveedorId_createdAt_idx"
  ON "ProveedorEvento"("tenantId", "proveedorId", "createdAt");

ALTER TABLE "ProveedorEvento"
  ADD CONSTRAINT "ProveedorEvento_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProveedorEvento_proveedorId_fkey"
    FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
