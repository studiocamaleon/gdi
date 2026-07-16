-- CreateTable
CREATE TABLE "ConfiguracionFiscal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "cuit" VARCHAR(11) NOT NULL,
    "condicionFiscal" TEXT NOT NULL DEFAULT 'RI',
    "ingresosBrutos" TEXT,
    "domicilioFiscal" TEXT,
    "inicioActividades" TIMESTAMP(3),
    "leyendaFacturaA" TEXT,
    "proveedorFacturacion" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuntoVenta" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "configuracionFiscalId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "modalidad" TEXT NOT NULL DEFAULT 'web_services',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PuntoVenta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionFiscal_tenantId_key" ON "ConfiguracionFiscal"("tenantId");

-- CreateIndex
CREATE INDEX "ConfiguracionFiscal_tenantId_idx" ON "ConfiguracionFiscal"("tenantId");

-- CreateIndex
CREATE INDEX "PuntoVenta_tenantId_activo_idx" ON "PuntoVenta"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "PuntoVenta_tenantId_numero_key" ON "PuntoVenta"("tenantId", "numero");

-- AddForeignKey
ALTER TABLE "ConfiguracionFiscal" ADD CONSTRAINT "ConfiguracionFiscal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuntoVenta" ADD CONSTRAINT "PuntoVenta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuntoVenta" ADD CONSTRAINT "PuntoVenta_configuracionFiscalId_fkey" FOREIGN KEY ("configuracionFiscalId") REFERENCES "ConfiguracionFiscal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
