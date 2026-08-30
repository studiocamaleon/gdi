-- Fase 4: condiciones operativas auditables por nodo de producción.
CREATE TABLE "OrdenTrabajoPasoGate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "pasoId" UUID NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "detalle" VARCHAR(500),
    "resueltoEl" TIMESTAMP(3),
    "resueltoPorId" UUID,
    "resueltoPorNombre" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenTrabajoPasoGate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrdenTrabajoPasoGate_pasoId_tipo_key"
ON "OrdenTrabajoPasoGate"("pasoId", "tipo");

CREATE INDEX "OrdenTrabajoPasoGate_tenantId_ordenId_idx"
ON "OrdenTrabajoPasoGate"("tenantId", "ordenId");

CREATE INDEX "OrdenTrabajoPasoGate_tenantId_estado_idx"
ON "OrdenTrabajoPasoGate"("tenantId", "estado");

ALTER TABLE "OrdenTrabajoPasoGate"
ADD CONSTRAINT "OrdenTrabajoPasoGate_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrdenTrabajoPasoGate"
ADD CONSTRAINT "OrdenTrabajoPasoGate_ordenId_fkey"
FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrdenTrabajoPasoGate"
ADD CONSTRAINT "OrdenTrabajoPasoGate_pasoId_fkey"
FOREIGN KEY ("pasoId") REFERENCES "OrdenTrabajoItemPaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
