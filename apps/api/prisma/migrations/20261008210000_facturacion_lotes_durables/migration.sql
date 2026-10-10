-- CreateTable
CREATE TABLE "FacturacionLote" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "claveSolicitud" UUID NOT NULL,
    "solicitudJson" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "proximaEjecucion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" UUID,
    "leaseHasta" TIMESTAMP(3),
    "notificadaEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacturacionLote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturacionLoteItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "loteId" UUID NOT NULL,
    "posicion" INTEGER NOT NULL,
    "ordenIds" UUID[],
    "numeros" TEXT[],
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "comprobanteId" UUID,
    "error" TEXT,
    "avisoEstado" TEXT NOT NULL DEFAULT 'pendiente',
    "avisoDetalle" TEXT,
    "pdfEstado" TEXT NOT NULL DEFAULT 'pendiente',
    "intentosPublicacion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacturacionLoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacturacionLote_estado_proximaEjecucion_leaseHasta_idx" ON "FacturacionLote"("estado", "proximaEjecucion", "leaseHasta");

-- CreateIndex
CREATE INDEX "FacturacionLote_tenantId_userId_createdAt_idx" ON "FacturacionLote"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FacturacionLote_tenantId_userId_claveSolicitud_key" ON "FacturacionLote"("tenantId", "userId", "claveSolicitud");

-- CreateIndex
CREATE UNIQUE INDEX "FacturacionLoteItem_comprobanteId_key" ON "FacturacionLoteItem"("comprobanteId");

-- CreateIndex
CREATE INDEX "FacturacionLoteItem_tenantId_loteId_idx" ON "FacturacionLoteItem"("tenantId", "loteId");

-- CreateIndex
CREATE UNIQUE INDEX "FacturacionLoteItem_loteId_posicion_key" ON "FacturacionLoteItem"("loteId", "posicion");

-- AddForeignKey
ALTER TABLE "FacturacionLote" ADD CONSTRAINT "FacturacionLote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturacionLote" ADD CONSTRAINT "FacturacionLote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturacionLoteItem" ADD CONSTRAINT "FacturacionLoteItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturacionLoteItem" ADD CONSTRAINT "FacturacionLoteItem_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "FacturacionLote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

