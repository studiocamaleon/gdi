-- CreateTable
CREATE TABLE "OrdenTrabajo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "clienteId" UUID,
    "vendedorEmpleadoId" UUID,
    "cotizacionId" UUID,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "fechaEmision" TIMESTAMP(3),
    "fechaEntrega" DATE,
    "observaciones" TEXT,
    "subtotal" DECIMAL(14,2),
    "impuestos" DECIMAL(14,2),
    "cargosDirectos" DECIMAL(14,2),
    "total" DECIMAL(14,2),
    "progresoPct" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenTrabajoItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "cotizacionItemId" UUID,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "familia" TEXT NOT NULL,
    "cantidad" DECIMAL(14,2) NOT NULL,
    "cantidadUnidad" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "impuestos" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "specsJson" JSONB,
    "adicionalesJson" JSONB,
    "ordenIndice" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdenTrabajoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenTrabajoEvento" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ordenId" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,

    CONSTRAINT "OrdenTrabajoEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenTrabajoContador" (
    "tenantId" UUID NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrdenTrabajoContador_pkey" PRIMARY KEY ("tenantId","anio")
);

-- CreateIndex
CREATE INDEX "OrdenTrabajo_tenantId_estado_idx" ON "OrdenTrabajo"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "OrdenTrabajo_tenantId_createdAt_idx" ON "OrdenTrabajo"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "OrdenTrabajo_tenantId_clienteId_idx" ON "OrdenTrabajo"("tenantId", "clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenTrabajo_tenantId_numero_key" ON "OrdenTrabajo"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "OrdenTrabajoItem_tenantId_ordenId_idx" ON "OrdenTrabajoItem"("tenantId", "ordenId");

-- CreateIndex
CREATE INDEX "OrdenTrabajoEvento_tenantId_ordenId_fecha_idx" ON "OrdenTrabajoEvento"("tenantId", "ordenId", "fecha");

-- AddForeignKey
ALTER TABLE "OrdenTrabajo" ADD CONSTRAINT "OrdenTrabajo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajo" ADD CONSTRAINT "OrdenTrabajo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajo" ADD CONSTRAINT "OrdenTrabajo_vendedorEmpleadoId_fkey" FOREIGN KEY ("vendedorEmpleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajo" ADD CONSTRAINT "OrdenTrabajo_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajoItem" ADD CONSTRAINT "OrdenTrabajoItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajoItem" ADD CONSTRAINT "OrdenTrabajoItem_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajoItem" ADD CONSTRAINT "OrdenTrabajoItem_cotizacionItemId_fkey" FOREIGN KEY ("cotizacionItemId") REFERENCES "CotizacionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajoEvento" ADD CONSTRAINT "OrdenTrabajoEvento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajoEvento" ADD CONSTRAINT "OrdenTrabajoEvento_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenTrabajoContador" ADD CONSTRAINT "OrdenTrabajoContador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
