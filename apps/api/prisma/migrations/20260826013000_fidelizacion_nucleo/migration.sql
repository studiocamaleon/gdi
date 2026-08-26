ALTER TABLE "Cotizacion"
  ADD COLUMN "fidelizacionCanjeMonto" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "fidelizacionCanjePuntos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fidelizacionMargenBase" DECIMAL(14,2),
  ADD COLUMN "fidelizacionPuntosEstimados" INTEGER,
  ADD COLUMN "fidelizacionSnapshotJson" JSONB;

ALTER TABLE "OrdenTrabajo"
  ADD COLUMN "fidelizacionCanjeMonto" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "fidelizacionCanjePuntos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fidelizacionMargenBase" DECIMAL(14,2),
  ADD COLUMN "fidelizacionPuntosEstimados" INTEGER,
  ADD COLUMN "fidelizacionSnapshotJson" JSONB;

ALTER TABLE "OrdenTrabajoItem"
  ADD COLUMN "fidelizacionDescuentoNeto" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE "ConfiguracionFidelizacion" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "acumulacionActiva" BOOLEAN NOT NULL DEFAULT false,
  "porcentajeMargen" DECIMAL(6,3) NOT NULL DEFAULT 1,
  "montoBase" DECIMAL(14,2) NOT NULL DEFAULT 1000,
  "puntosBase" INTEGER NOT NULL DEFAULT 100,
  "activadaEl" TIMESTAMP(3),
  "conversionBloqueadaEl" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConfiguracionFidelizacion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConfiguracionFidelizacion_tenantId_key" ON "ConfiguracionFidelizacion"("tenantId");

CREATE TABLE "FidelizacionCuenta" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "clienteId" UUID NOT NULL,
  "saldoPuntos" INTEGER NOT NULL DEFAULT 0,
  "reservadosPuntos" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FidelizacionCuenta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FidelizacionCuenta_clienteId_key" ON "FidelizacionCuenta"("clienteId");
CREATE INDEX "FidelizacionCuenta_tenantId_saldoPuntos_idx" ON "FidelizacionCuenta"("tenantId", "saldoPuntos");

CREATE TABLE "FidelizacionMovimiento" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "cuentaId" UUID NOT NULL,
  "clienteId" UUID NOT NULL,
  "tipo" TEXT NOT NULL,
  "deltaPuntos" INTEGER NOT NULL,
  "montoEquivalente" DECIMAL(14,2) NOT NULL,
  "montoBaseSnapshot" DECIMAL(14,2) NOT NULL,
  "puntosBaseSnapshot" INTEGER NOT NULL,
  "ordenId" UUID,
  "cotizacionId" UUID,
  "reversionDeId" UUID,
  "actorId" UUID,
  "actorNombre" TEXT NOT NULL,
  "motivo" VARCHAR(500),
  "idempotencyKey" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FidelizacionMovimiento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FidelizacionMovimiento_reversionDeId_key" ON "FidelizacionMovimiento"("reversionDeId");
CREATE UNIQUE INDEX "FidelizacionMovimiento_tenantId_idempotencyKey_key" ON "FidelizacionMovimiento"("tenantId", "idempotencyKey");
CREATE INDEX "FidelizacionMovimiento_tenantId_clienteId_createdAt_idx" ON "FidelizacionMovimiento"("tenantId", "clienteId", "createdAt");
CREATE INDEX "FidelizacionMovimiento_tenantId_ordenId_idx" ON "FidelizacionMovimiento"("tenantId", "ordenId");

CREATE TABLE "FidelizacionReserva" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "cuentaId" UUID NOT NULL,
  "clienteId" UUID NOT NULL,
  "cotizacionId" UUID,
  "ordenId" UUID,
  "puntos" INTEGER NOT NULL,
  "monto" DECIMAL(14,2) NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'RESERVADA',
  "expiraEl" TIMESTAMP(3),
  "consumidaEl" TIMESTAMP(3),
  "liberadaEl" TIMESTAMP(3),
  "liberadaMotivo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FidelizacionReserva_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FidelizacionReserva_tenantId_clienteId_estado_idx" ON "FidelizacionReserva"("tenantId", "clienteId", "estado");
CREATE INDEX "FidelizacionReserva_tenantId_cotizacionId_idx" ON "FidelizacionReserva"("tenantId", "cotizacionId");
CREATE INDEX "FidelizacionReserva_tenantId_ordenId_idx" ON "FidelizacionReserva"("tenantId", "ordenId");

ALTER TABLE "ConfiguracionFidelizacion" ADD CONSTRAINT "ConfiguracionFidelizacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FidelizacionCuenta" ADD CONSTRAINT "FidelizacionCuenta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FidelizacionCuenta" ADD CONSTRAINT "FidelizacionCuenta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FidelizacionMovimiento" ADD CONSTRAINT "FidelizacionMovimiento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FidelizacionMovimiento" ADD CONSTRAINT "FidelizacionMovimiento_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "FidelizacionCuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FidelizacionMovimiento" ADD CONSTRAINT "FidelizacionMovimiento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FidelizacionMovimiento" ADD CONSTRAINT "FidelizacionMovimiento_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FidelizacionMovimiento" ADD CONSTRAINT "FidelizacionMovimiento_reversionDeId_fkey" FOREIGN KEY ("reversionDeId") REFERENCES "FidelizacionMovimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FidelizacionReserva" ADD CONSTRAINT "FidelizacionReserva_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FidelizacionReserva" ADD CONSTRAINT "FidelizacionReserva_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "FidelizacionCuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FidelizacionReserva" ADD CONSTRAINT "FidelizacionReserva_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FidelizacionReserva" ADD CONSTRAINT "FidelizacionReserva_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FidelizacionReserva" ADD CONSTRAINT "FidelizacionReserva_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Conserva el acceso a Clientes al moverlo a CRM. Los permisos existentes de
-- Registros no se quitan porque siguen cubriendo Proveedores y Empleados.
UPDATE "Rol" SET "permisos" = array_append("permisos", 'crm.ver')
WHERE ('registros.ver' = ANY("permisos") OR 'registros.gestionar' = ANY("permisos"))
  AND NOT ('crm.ver' = ANY("permisos"));
UPDATE "Rol" SET "permisos" = array_append("permisos", 'crm.gestionar')
WHERE 'registros.gestionar' = ANY("permisos") AND NOT ('crm.gestionar' = ANY("permisos"));
UPDATE "Rol" SET "permisos" = array_append("permisos", 'crm.configurar_fidelizacion')
WHERE "codigo" = 'administrador' AND NOT ('crm.configurar_fidelizacion' = ANY("permisos"));
