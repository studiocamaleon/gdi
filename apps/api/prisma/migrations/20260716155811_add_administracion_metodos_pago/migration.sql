-- CreateTable
CREATE TABLE "CuentaFondos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "banco" TEXT,
    "cbuAlias" TEXT,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "saldo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaFondos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetodoPago" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "comisionPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "ivaComisionPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "plazoAcreditacionDias" INTEGER NOT NULL DEFAULT 0,
    "sufreRetencion" BOOLEAN NOT NULL DEFAULT false,
    "cuentaDestinoId" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetodoPago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CuentaFondos_tenantId_activo_idx" ON "CuentaFondos"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaFondos_tenantId_nombre_key" ON "CuentaFondos"("tenantId", "nombre");

-- CreateIndex
CREATE INDEX "MetodoPago_tenantId_activo_idx" ON "MetodoPago"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "MetodoPago_tenantId_codigo_key" ON "MetodoPago"("tenantId", "codigo");

-- AddForeignKey
ALTER TABLE "CuentaFondos" ADD CONSTRAINT "CuentaFondos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodoPago" ADD CONSTRAINT "MetodoPago_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetodoPago" ADD CONSTRAINT "MetodoPago_cuentaDestinoId_fkey" FOREIGN KEY ("cuentaDestinoId") REFERENCES "CuentaFondos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
