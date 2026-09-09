CREATE TABLE "NestingCheckpoint" (
  "tenantId" UUID NOT NULL,
  "clave" VARCHAR(64) NOT NULL,
  "resultadoJson" JSONB NOT NULL,
  "solicitudId" TEXT NOT NULL,
  "transcurridoMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NestingCheckpoint_pkey" PRIMARY KEY ("tenantId", "clave"),
  CONSTRAINT "NestingCheckpoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
