CREATE TABLE "MaquinaHistorial" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "maquinaId" UUID NOT NULL,
    "accion" TEXT NOT NULL,
    "actorId" TEXT,
    "actorNombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cambiosJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaquinaHistorial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaquinaHistorial_tenantId_maquinaId_createdAt_idx"
ON "MaquinaHistorial"("tenantId", "maquinaId", "createdAt");

ALTER TABLE "MaquinaHistorial"
ADD CONSTRAINT "MaquinaHistorial_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaquinaHistorial"
ADD CONSTRAINT "MaquinaHistorial_maquinaId_fkey"
FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE;
