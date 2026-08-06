-- DropForeignKey
ALTER TABLE "FamiliaTenant" DROP CONSTRAINT "FamiliaTenant_tenantId_fkey";

-- DropTable
DROP TABLE "FamiliaTenant";

-- CreateTable
CREATE TABLE "PasoTenant" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "plantillaCodigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "icono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "centroCostoId" UUID,
    "productividadHora" DECIMAL(12,2),
    "tiempoFijoMin" DECIMAL(10,2),
    "demasiaMm" DECIMAL(8,2),
    "solapePanelMm" DECIMAL(8,2),
    "tercerizado" BOOLEAN,
    "proveedorId" UUID,
    "fuenteCostoTercerizado" TEXT,
    "plazoProveedorDias" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasoTenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasoTenant_tenantId_activo_idx" ON "PasoTenant"("tenantId", "activo");

-- CreateIndex
CREATE INDEX "PasoTenant_tenantId_plantillaCodigo_idx" ON "PasoTenant"("tenantId", "plantillaCodigo");

-- CreateIndex
CREATE UNIQUE INDEX "PasoTenant_tenantId_nombre_key" ON "PasoTenant"("tenantId", "nombre");

-- AddForeignKey
ALTER TABLE "PasoTenant" ADD CONSTRAINT "PasoTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoTenant" ADD CONSTRAINT "PasoTenant_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoTenant" ADD CONSTRAINT "PasoTenant_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

