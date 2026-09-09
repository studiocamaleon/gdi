CREATE TABLE "CarteraNestingGuardada" (
  "tenantId" UUID NOT NULL,
  "clave" VARCHAR(64) NOT NULL,
  "patronesJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarteraNestingGuardada_pkey" PRIMARY KEY ("tenantId", "clave"),
  CONSTRAINT "CarteraNestingGuardada_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
