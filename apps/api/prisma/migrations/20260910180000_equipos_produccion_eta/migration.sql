CREATE TABLE "EquipoProduccion" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "nombre" TEXT NOT NULL,
  "personas" INTEGER NOT NULL CHECK ("personas" BETWEEN 1 AND 99),
  "calendarioJson" JSONB NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EquipoProduccion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EquipoProduccion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EquipoProduccion_tenantId_nombre_key" ON "EquipoProduccion"("tenantId", "nombre");
CREATE INDEX "EquipoProduccion_tenantId_activo_idx" ON "EquipoProduccion"("tenantId", "activo");
ALTER TABLE "Estacion" ADD COLUMN "equipoProduccionId" UUID;
ALTER TABLE "Estacion" ADD CONSTRAINT "Estacion_equipoProduccionId_fkey" FOREIGN KEY ("equipoProduccionId") REFERENCES "EquipoProduccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Estacion_tenantId_equipoProduccionId_idx" ON "Estacion"("tenantId", "equipoProduccionId");
ALTER TABLE "OrdenTrabajoItemPaso" ADD COLUMN "demandaHumanaJson" JSONB;
