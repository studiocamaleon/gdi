-- CreateEnum
CREATE TYPE "ProveedorIntegracion" AS ENUM ('WATI', 'AFIP', 'MERCADOPAGO');

-- CreateEnum
CREATE TYPE "EstadoIntegracion" AS ENUM ('DESCONECTADA', 'CONECTADA', 'ERROR');

-- CreateTable
CREATE TABLE "IntegracionTenant" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "proveedor" "ProveedorIntegracion" NOT NULL,
    "estado" "EstadoIntegracion" NOT NULL DEFAULT 'DESCONECTADA',
    "credencialesCifradas" JSONB,
    "pista" TEXT,
    "metadataJson" JSONB,
    "ultimoChequeoEl" TIMESTAMP(3),
    "ultimoErrorTexto" TEXT,
    "conectadaEl" TIMESTAMP(3),
    "conectadaPorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegracionTenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegracionTenant_tenantId_estado_idx" ON "IntegracionTenant"("tenantId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "IntegracionTenant_tenantId_proveedor_key" ON "IntegracionTenant"("tenantId", "proveedor");

-- AddForeignKey
ALTER TABLE "IntegracionTenant" ADD CONSTRAINT "IntegracionTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegracionTenant" ADD CONSTRAINT "IntegracionTenant_conectadaPorId_fkey" FOREIGN KEY ("conectadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

