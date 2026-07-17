-- CreateTable
CREATE TABLE "Comprobante" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "letra" VARCHAR(1) NOT NULL,
    "puntoVentaId" UUID NOT NULL,
    "numero" INTEGER,
    "fecha" DATE NOT NULL,
    "clienteId" UUID,
    "ordenId" UUID,
    "receptorSnapshot" JSONB NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "netoGravado" DECIMAL(14,2) NOT NULL,
    "ivaPorAlicuota" JSONB NOT NULL,
    "ivaTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "cotizacion" DECIMAL(14,4),
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "cae" TEXT,
    "caeVencimiento" TIMESTAMP(3),
    "condicionVenta" TEXT,
    "vencimiento" DATE,
    "leyenda" TEXT,
    "rechazoJson" JSONB,
    "providerRaw" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "saldoPendiente" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "comprobanteOrigenId" UUID,
    "anuladoEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComprobanteContador" (
    "tenantId" UUID NOT NULL,
    "puntoVentaId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "letra" VARCHAR(1) NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComprobanteContador_pkey" PRIMARY KEY ("tenantId","puntoVentaId","tipo","letra")
);

-- CreateTable
CREATE TABLE "CobroImputacion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cobroId" UUID NOT NULL,
    "comprobanteId" UUID NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CobroImputacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Comprobante_idempotencyKey_key" ON "Comprobante"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Comprobante_tenantId_estado_idx" ON "Comprobante"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "Comprobante_tenantId_clienteId_idx" ON "Comprobante"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "Comprobante_tenantId_ordenId_idx" ON "Comprobante"("tenantId", "ordenId");

-- CreateIndex
CREATE INDEX "Comprobante_tenantId_vencimiento_idx" ON "Comprobante"("tenantId", "vencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "Comprobante_tenantId_puntoVentaId_tipo_letra_numero_key" ON "Comprobante"("tenantId", "puntoVentaId", "tipo", "letra", "numero");

-- CreateIndex
CREATE INDEX "CobroImputacion_tenantId_comprobanteId_idx" ON "CobroImputacion"("tenantId", "comprobanteId");

-- CreateIndex
CREATE UNIQUE INDEX "CobroImputacion_cobroId_comprobanteId_key" ON "CobroImputacion"("cobroId", "comprobanteId");

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_puntoVentaId_fkey" FOREIGN KEY ("puntoVentaId") REFERENCES "PuntoVenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_comprobanteOrigenId_fkey" FOREIGN KEY ("comprobanteOrigenId") REFERENCES "Comprobante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprobanteContador" ADD CONSTRAINT "ComprobanteContador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprobanteContador" ADD CONSTRAINT "ComprobanteContador_puntoVentaId_fkey" FOREIGN KEY ("puntoVentaId") REFERENCES "PuntoVenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobroImputacion" ADD CONSTRAINT "CobroImputacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobroImputacion" ADD CONSTRAINT "CobroImputacion_cobroId_fkey" FOREIGN KEY ("cobroId") REFERENCES "Cobro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CobroImputacion" ADD CONSTRAINT "CobroImputacion_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "Comprobante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
