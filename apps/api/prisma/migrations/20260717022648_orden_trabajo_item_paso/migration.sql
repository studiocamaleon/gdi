-- CreateTable
CREATE TABLE "OrdenTrabajoItemPaso" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "indice" INTEGER NOT NULL,
    "rutaPasoId" TEXT,
    "familiaCodigo" TEXT NOT NULL,
    "categoriaFamilia" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "centroCostoId" UUID,
    "centroCostoNombre" TEXT,
    "duracionEstimadaMin" DECIMAL(10,2),
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "motivoBloqueo" TEXT,
    "iniciadoEl" TIMESTAMP(3),
    "completadoEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenTrabajoItemPaso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrdenTrabajoItemPaso_tenantId_ordenId_idx" ON "OrdenTrabajoItemPaso"("tenantId", "ordenId");

-- CreateIndex
CREATE INDEX "OrdenTrabajoItemPaso_tenantId_itemId_idx" ON "OrdenTrabajoItemPaso"("tenantId", "itemId");

-- CreateIndex
CREATE INDEX "OrdenTrabajoItemPaso_tenantId_estado_idx" ON "OrdenTrabajoItemPaso"("tenantId", "estado");

-- AddForeignKey
ALTER TABLE "OrdenTrabajoItemPaso" ADD CONSTRAINT "OrdenTrabajoItemPaso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajoItemPaso" ADD CONSTRAINT "OrdenTrabajoItemPaso_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajoItemPaso" ADD CONSTRAINT "OrdenTrabajoItemPaso_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "OrdenTrabajoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
