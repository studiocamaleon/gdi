-- CreateEnum
CREATE TYPE "TipoImpresionProductoVariante" AS ENUM ('BN', 'CMYK');

-- CreateEnum
CREATE TYPE "CarasProductoVariante" AS ENUM ('SIMPLE_FAZ', 'DOBLE_FAZ');

-- CreateTable
CREATE TABLE "ProductoVariante" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productoServicioId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "anchoMm" DECIMAL(12,2) NOT NULL,
    "altoMm" DECIMAL(12,2) NOT NULL,
    "papelVarianteId" UUID,
    "tipoImpresion" "TipoImpresionProductoVariante" NOT NULL,
    "caras" "CarasProductoVariante" NOT NULL,
    "procesoDefinicionId" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoVariante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductoVariante_tenantId_productoServicioId_activo_idx" ON "ProductoVariante"("tenantId", "productoServicioId", "activo");

-- CreateIndex
CREATE INDEX "ProductoVariante_tenantId_procesoDefinicionId_idx" ON "ProductoVariante"("tenantId", "procesoDefinicionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoVariante_tenantId_productoServicioId_nombre_key" ON "ProductoVariante"("tenantId", "productoServicioId", "nombre");

-- AddForeignKey
ALTER TABLE "ProductoVariante" ADD CONSTRAINT "ProductoVariante_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoVariante" ADD CONSTRAINT "ProductoVariante_productoServicioId_fkey" FOREIGN KEY ("productoServicioId") REFERENCES "ProductoServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoVariante" ADD CONSTRAINT "ProductoVariante_papelVarianteId_fkey" FOREIGN KEY ("papelVarianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoVariante" ADD CONSTRAINT "ProductoVariante_procesoDefinicionId_fkey" FOREIGN KEY ("procesoDefinicionId") REFERENCES "ProcesoDefinicion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ProductoServicio_tenantId_familiaProductoId_subfamiliaProductoI" RENAME TO "ProductoServicio_tenantId_familiaProductoId_subfamiliaProdu_idx";
