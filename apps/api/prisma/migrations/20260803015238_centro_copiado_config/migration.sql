-- CreateTable
CREATE TABLE "CentroCopiadoConfig" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "maquinaColorId" UUID,
    "maquinaBnId" UUID,
    "papelesJson" JSONB,
    "tamanosJson" JSONB,
    "terminacionesJson" JSONB,
    "precioConfigJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCopiadoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CentroCopiadoConfig_tenantId_key" ON "CentroCopiadoConfig"("tenantId");

-- AddForeignKey
ALTER TABLE "CentroCopiadoConfig" ADD CONSTRAINT "CentroCopiadoConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
