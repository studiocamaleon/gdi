-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "canalVenta" TEXT,
ADD COLUMN     "convertidaOrdenId" UUID,
ADD COLUMN     "emisionJson" JSONB,
ADD COLUMN     "fechaEnvio" TIMESTAMP(3),
ADD COLUMN     "fechaResuelto" TIMESTAMP(3),
ADD COLUMN     "impuestos" DECIMAL(14,2),
ADD COLUMN     "motivoPerdida" TEXT,
ADD COLUMN     "motivoPerdidaDetalle" VARCHAR(300),
ADD COLUMN     "primeraVistaEl" TIMESTAMP(3),
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "senaSugeridaPct" DECIMAL(5,2),
ADD COLUMN     "vendedorEmpleadoId" UUID;

-- CreateTable
CREATE TABLE "CotizacionContador" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CotizacionContador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionEvento" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cotizacionId" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "usuarioId" UUID,
    "usuarioNombre" TEXT NOT NULL,
    "datosJson" JSONB,
    "origen" TEXT NOT NULL DEFAULT 'usuario',

    CONSTRAINT "CotizacionEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionPresupuestos" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "validezDiasDefault" INTEGER NOT NULL DEFAULT 15,
    "senaSugeridaPctDefault" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "condicionesTexto" TEXT,
    "aprobacionMontoMax" DECIMAL(14,2),
    "aprobacionMargenMinPct" DECIMAL(5,2),
    "aprobacionDescuentoMaxPct" DECIMAL(5,2),
    "requiereAprobacionSinCosteo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionPresupuestos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CotizacionContador_tenantId_anio_key" ON "CotizacionContador"("tenantId", "anio");

-- CreateIndex
CREATE INDEX "CotizacionEvento_tenantId_cotizacionId_fecha_idx" ON "CotizacionEvento"("tenantId", "cotizacionId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionPresupuestos_tenantId_key" ON "ConfiguracionPresupuestos"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_publicToken_key" ON "Cotizacion"("publicToken");

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_vendedorEmpleadoId_fkey" FOREIGN KEY ("vendedorEmpleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionContador" ADD CONSTRAINT "CotizacionContador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionEvento" ADD CONSTRAINT "CotizacionEvento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotizacionEvento" ADD CONSTRAINT "CotizacionEvento_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfiguracionPresupuestos" ADD CONSTRAINT "ConfiguracionPresupuestos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

