-- Control plane, etapa B2: facturación de suscripciones desde el tenant
-- plataforma. Ver docs/control-plane-diseno.md

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "esPlataforma" BOOLEAN NOT NULL DEFAULT false;

-- Uno solo puede ser el tenant plataforma (índice único parcial: Prisma no
-- lo expresa en el schema, vive acá).
CREATE UNIQUE INDEX "Tenant_esPlataforma_unico" ON "Tenant"("esPlataforma") WHERE "esPlataforma";

-- CreateTable
CREATE TABLE "FacturaSuscripcion" (
    "id" UUID NOT NULL,
    "suscripcionId" UUID NOT NULL,
    "tenantClienteId" UUID NOT NULL,
    "periodo" TEXT NOT NULL,
    "comprobanteId" UUID NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacturaSuscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FacturaSuscripcion_comprobanteId_key" ON "FacturaSuscripcion"("comprobanteId");
CREATE UNIQUE INDEX "FacturaSuscripcion_suscripcionId_periodo_key" ON "FacturaSuscripcion"("suscripcionId", "periodo");
CREATE INDEX "FacturaSuscripcion_periodo_idx" ON "FacturaSuscripcion"("periodo");
CREATE INDEX "FacturaSuscripcion_tenantClienteId_idx" ON "FacturaSuscripcion"("tenantClienteId");

-- AddForeignKey
ALTER TABLE "FacturaSuscripcion" ADD CONSTRAINT "FacturaSuscripcion_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "Comprobante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
