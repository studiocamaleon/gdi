-- SM.D — Materiales declarativos a nivel paso.
-- Cada ProcesoOperacion puede declarar sus materiales consumidos,
-- reemplazando las "plantillas" imperativas del super motor.

CREATE TABLE "ProcesoOperacionMaterial" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "procesoOperacionId" UUID NOT NULL,
    "materiaPrimaVarianteId" UUID,
    "nombre" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "cantidadPorUnidad" DECIMAL(14,6) NOT NULL,
    "unidad" TEXT NOT NULL,
    "precioManual" DECIMAL(14,4),
    "aplicaMultiCaras" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProcesoOperacionMaterial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcesoOperacionMaterial_tenantId_procesoOperacionId_activo_idx"
    ON "ProcesoOperacionMaterial"("tenantId", "procesoOperacionId", "activo");

CREATE INDEX "ProcesoOperacionMaterial_tenantId_materiaPrimaVarianteId_idx"
    ON "ProcesoOperacionMaterial"("tenantId", "materiaPrimaVarianteId");

ALTER TABLE "ProcesoOperacionMaterial"
    ADD CONSTRAINT "ProcesoOperacionMaterial_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacionMaterial"
    ADD CONSTRAINT "ProcesoOperacionMaterial_procesoOperacionId_fkey"
    FOREIGN KEY ("procesoOperacionId") REFERENCES "ProcesoOperacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacionMaterial"
    ADD CONSTRAINT "ProcesoOperacionMaterial_materiaPrimaVarianteId_fkey"
    FOREIGN KEY ("materiaPrimaVarianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE SET NULL ON UPDATE CASCADE;
