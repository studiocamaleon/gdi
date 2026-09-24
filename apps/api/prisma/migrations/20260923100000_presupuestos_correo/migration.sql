ALTER TABLE "ConfiguracionPresupuestos"
  ADD COLUMN "correoResponderA" VARCHAR(254),
  ADD COLUMN "correoAsunto" VARCHAR(200),
  ADD COLUMN "correoMensaje" TEXT;

ALTER TABLE "Cotizacion" ADD COLUMN "notificarWhatsapp" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "CorreoPresupuesto" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "cotizacionId" UUID NOT NULL,
  "idempotencia" UUID NOT NULL,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  "para" VARCHAR(254) NOT NULL,
  "responderA" VARCHAR(254) NOT NULL,
  "remitente" TEXT NOT NULL,
  "empresa" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "asunto" VARCHAR(200) NOT NULL,
  "mensaje" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "archivoId" UUID,
  "documentoPdfId" UUID,
  "usuarioId" UUID NOT NULL,
  "usuarioNombre" TEXT NOT NULL,
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "primerIntentoEl" TIMESTAMP(3),
  "leaseHasta" TIMESTAMP(3),
  "proximoIntentoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "proveedorId" TEXT,
  "error" TEXT,
  "enviadoEl" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CorreoPresupuesto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CorreoPresupuesto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CorreoPresupuesto_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CorreoPresupuesto_tenantId_idempotencia_key" ON "CorreoPresupuesto"("tenantId", "idempotencia");
CREATE INDEX "CorreoPresupuesto_estado_proximoIntentoEl_idx" ON "CorreoPresupuesto"("estado", "proximoIntentoEl");
CREATE INDEX "CorreoPresupuesto_tenantId_cotizacionId_createdAt_idx" ON "CorreoPresupuesto"("tenantId", "cotizacionId", "createdAt");
