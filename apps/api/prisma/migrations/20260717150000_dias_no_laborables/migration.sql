-- Feriados y cierres del taller (docs/capacidad-estaciones-diseno.md D8):
-- fechas no laborables a nivel tenant, consumidas por la proyección de
-- cola del tablero y la simulación de flujo.
CREATE TABLE "DiaNoLaborable" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaNoLaborable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiaNoLaborable_tenantId_fecha_key" ON "DiaNoLaborable"("tenantId", "fecha");

CREATE INDEX "DiaNoLaborable_tenantId_fecha_idx" ON "DiaNoLaborable"("tenantId", "fecha");

ALTER TABLE "DiaNoLaborable" ADD CONSTRAINT "DiaNoLaborable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
