-- AlterTable
ALTER TABLE "ProductoConfigPaso" ADD COLUMN     "fuenteCostoTercerizado" TEXT,
ADD COLUMN     "plazoProveedorDias" INTEGER,
ADD COLUMN     "proveedorId" UUID,
ADD COLUMN     "tercerizado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tercerizadoConfigJson" JSONB;

-- CreateTable
CREATE TABLE "PasoTercerizadoEntrada" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoConfigPasoId" UUID NOT NULL,
    "valoresJson" JSONB NOT NULL,
    "claveMatch" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costo" DECIMAL(14,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasoTercerizadoEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasoTercerizadoEntrada_tenantId_productoConfigPasoId_idx" ON "PasoTercerizadoEntrada"("tenantId", "productoConfigPasoId");

-- CreateIndex
CREATE UNIQUE INDEX "PasoTercerizadoEntrada_productoConfigPasoId_claveMatch_key" ON "PasoTercerizadoEntrada"("productoConfigPasoId", "claveMatch");

-- CreateIndex
CREATE INDEX "ProductoConfigPaso_tenantId_proveedorId_idx" ON "ProductoConfigPaso"("tenantId", "proveedorId");

-- AddForeignKey
ALTER TABLE "ProductoConfigPaso" ADD CONSTRAINT "ProductoConfigPaso_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoTercerizadoEntrada" ADD CONSTRAINT "PasoTercerizadoEntrada_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasoTercerizadoEntrada" ADD CONSTRAINT "PasoTercerizadoEntrada_productoConfigPasoId_fkey" FOREIGN KEY ("productoConfigPasoId") REFERENCES "ProductoConfigPaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

