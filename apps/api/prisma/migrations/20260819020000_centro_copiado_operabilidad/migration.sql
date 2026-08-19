ALTER TABLE "CentroCopiadoConfig"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "CentroCopiadoEvento" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "actorUserId" UUID,
  "actorNombre" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL,
  "datosJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CentroCopiadoEvento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CentroCopiadoOperacion" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "tipo" TEXT NOT NULL,
  "idempotencyKey" VARCHAR(100) NOT NULL,
  "estado" TEXT NOT NULL,
  "resultadoJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CentroCopiadoOperacion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CentroCopiadoEvento_tenantId_createdAt_idx"
ON "CentroCopiadoEvento"("tenantId", "createdAt");

CREATE INDEX "CentroCopiadoOperacion_tenantId_createdAt_idx"
ON "CentroCopiadoOperacion"("tenantId", "createdAt");

CREATE UNIQUE INDEX "CentroCopiadoOperacion_tenantId_tipo_idempotencyKey_key"
ON "CentroCopiadoOperacion"("tenantId", "tipo", "idempotencyKey");

ALTER TABLE "CentroCopiadoEvento"
ADD CONSTRAINT "CentroCopiadoEvento_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CentroCopiadoOperacion"
ADD CONSTRAINT "CentroCopiadoOperacion_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
