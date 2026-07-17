-- Margen de seguridad configurable sobre la ETA sugerida (docs/
-- simulacion-flujo-diseno.md D13): configuración de producción por tenant.
CREATE TABLE "ConfiguracionProduccion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "margenEtaDias" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionProduccion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfiguracionProduccion_tenantId_key" ON "ConfiguracionProduccion"("tenantId");

ALTER TABLE "ConfiguracionProduccion" ADD CONSTRAINT "ConfiguracionProduccion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
