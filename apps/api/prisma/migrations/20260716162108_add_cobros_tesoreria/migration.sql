-- CreateTable
CREATE TABLE "MovimientoFondos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cuentaId" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "origenTipo" TEXT NOT NULL,
    "cobroId" UUID,
    "valorId" UUID,
    "transferenciaParId" UUID,
    "ordenId" UUID,
    "saldoPosterior" DECIMAL(14,2) NOT NULL,
    "estadoConciliacion" TEXT NOT NULL DEFAULT 'pendiente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoFondos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cobro" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "clienteId" UUID,
    "ordenId" UUID,
    "fecha" TIMESTAMP(3) NOT NULL,
    "metodoPagoId" UUID NOT NULL,
    "cuentaDestinoId" UUID NOT NULL,
    "montoBruto" DECIMAL(14,2) NOT NULL,
    "comisionPctAplicada" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "comisionMonto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "comisionIvaMonto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netoAcreditado" DECIMAL(14,2) NOT NULL,
    "retencionesTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "disponibleReal" DECIMAL(14,2) NOT NULL,
    "fechaAcreditacionEstimada" TIMESTAMP(3),
    "estadoAcreditacion" TEXT NOT NULL DEFAULT 'pendiente',
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "notas" TEXT,
    "anuladoEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cobro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetencionPercepcion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cobroId" UUID,
    "direccion" TEXT NOT NULL DEFAULT 'sufrida',
    "regimen" TEXT NOT NULL,
    "jurisdiccion" TEXT,
    "base" DECIMAL(14,2) NOT NULL,
    "alicuota" DECIMAL(6,3) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "nroComprobante" TEXT,
    "periodoFiscal" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetencionPercepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valor" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "origen" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "modalidad" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "fechaEmision" TIMESTAMP(3),
    "fechaPago" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'cartera',
    "clienteId" UUID,
    "proveedorId" UUID,
    "cobroId" UUID,
    "cuentaDepositoId" UUID,
    "motivoRechazo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Valor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovimientoFondos_tenantId_cuentaId_fecha_idx" ON "MovimientoFondos"("tenantId", "cuentaId", "fecha");

-- CreateIndex
CREATE INDEX "Cobro_tenantId_ordenId_idx" ON "Cobro"("tenantId", "ordenId");

-- CreateIndex
CREATE INDEX "Cobro_tenantId_clienteId_idx" ON "Cobro"("tenantId", "clienteId");

-- CreateIndex
CREATE INDEX "Cobro_tenantId_estadoAcreditacion_idx" ON "Cobro"("tenantId", "estadoAcreditacion");

-- CreateIndex
CREATE INDEX "RetencionPercepcion_tenantId_periodoFiscal_idx" ON "RetencionPercepcion"("tenantId", "periodoFiscal");

-- CreateIndex
CREATE INDEX "RetencionPercepcion_tenantId_regimen_idx" ON "RetencionPercepcion"("tenantId", "regimen");

-- CreateIndex
CREATE INDEX "Valor_tenantId_estado_idx" ON "Valor"("tenantId", "estado");

-- AddForeignKey
ALTER TABLE "MovimientoFondos" ADD CONSTRAINT "MovimientoFondos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFondos" ADD CONSTRAINT "MovimientoFondos_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaFondos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFondos" ADD CONSTRAINT "MovimientoFondos_cobroId_fkey" FOREIGN KEY ("cobroId") REFERENCES "Cobro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFondos" ADD CONSTRAINT "MovimientoFondos_valorId_fkey" FOREIGN KEY ("valorId") REFERENCES "Valor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoFondos" ADD CONSTRAINT "MovimientoFondos_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobro" ADD CONSTRAINT "Cobro_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobro" ADD CONSTRAINT "Cobro_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobro" ADD CONSTRAINT "Cobro_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobro" ADD CONSTRAINT "Cobro_metodoPagoId_fkey" FOREIGN KEY ("metodoPagoId") REFERENCES "MetodoPago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobro" ADD CONSTRAINT "Cobro_cuentaDestinoId_fkey" FOREIGN KEY ("cuentaDestinoId") REFERENCES "CuentaFondos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetencionPercepcion" ADD CONSTRAINT "RetencionPercepcion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetencionPercepcion" ADD CONSTRAINT "RetencionPercepcion_cobroId_fkey" FOREIGN KEY ("cobroId") REFERENCES "Cobro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valor" ADD CONSTRAINT "Valor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valor" ADD CONSTRAINT "Valor_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valor" ADD CONSTRAINT "Valor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valor" ADD CONSTRAINT "Valor_cobroId_fkey" FOREIGN KEY ("cobroId") REFERENCES "Cobro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valor" ADD CONSTRAINT "Valor_cuentaDepositoId_fkey" FOREIGN KEY ("cuentaDepositoId") REFERENCES "CuentaFondos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
