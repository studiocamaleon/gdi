-- Umbrales configurables de las alertas del Panel (docs/reportes-plan-backend.md §5).
CREATE TABLE "ConfiguracionInsights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "diasClienteDormido" INTEGER NOT NULL DEFAULT 60,
    "deudaVencidaPctMax" INTEGER NOT NULL DEFAULT 20,
    "concentracionPctMax" INTEGER NOT NULL DEFAULT 50,
    "mesesTarifaVieja" INTEGER NOT NULL DEFAULT 3,
    "razonTiemposPctMax" INTEGER NOT NULL DEFAULT 150,
    "utilizacionPctMin" INTEGER NOT NULL DEFAULT 40,
    "margenPctMin" INTEGER NOT NULL DEFAULT 25,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionInsights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfiguracionInsights_tenantId_key" ON "ConfiguracionInsights"("tenantId");

ALTER TABLE "ConfiguracionInsights" ADD CONSTRAINT "ConfiguracionInsights_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
