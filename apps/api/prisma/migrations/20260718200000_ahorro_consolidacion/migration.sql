-- Ahorro de material concretado al consolidar tandas en el simulador gran
-- formato: el "cuánto ahorra la empresa gracias al sistema" acumulado.
CREATE TABLE "AhorroConsolidacion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "usuarioId" UUID,
    "usuarioNombre" TEXT NOT NULL,
    "materiaPrimaId" UUID,
    "materiaPrimaNombre" TEXT NOT NULL,
    "tecnologia" TEXT,
    "jobs" INTEGER NOT NULL,
    "consumoSeparadoMl" DECIMAL(12,2) NOT NULL,
    "consumoConsolidadoMl" DECIMAL(12,2) NOT NULL,
    "ahorroMl" DECIMAL(12,2) NOT NULL,
    "costoSeparado" DECIMAL(14,2),
    "costoConsolidado" DECIMAL(14,2),
    "ahorroPesos" DECIMAL(14,2),
    "baselineParcial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AhorroConsolidacion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AhorroConsolidacion_tenantId_createdAt_idx" ON "AhorroConsolidacion"("tenantId", "createdAt");

ALTER TABLE "AhorroConsolidacion" ADD CONSTRAINT "AhorroConsolidacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AhorroConsolidacion" ADD CONSTRAINT "AhorroConsolidacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
