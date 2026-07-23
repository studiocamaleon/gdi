-- F2 de la integración con Wati: control por tenant, consentimiento del
-- cliente final y cola de envíos.
-- Ver docs/notificaciones-whatsapp-catalogo.md §4

-- Consentimiento. Arranca en false a propósito: WhatsApp exige opt-in y la
-- ley 25.326 también, así que backfillear a true sería la trampa.
ALTER TABLE "Cliente" ADD COLUMN "aceptaWhatsapp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Cliente" ADD COLUMN "aceptaWhatsappEl" TIMESTAMP(3);

CREATE TABLE "ConfiguracionNotificaciones" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "pausado" BOOLEAN NOT NULL DEFAULT false,
    "horaDesde" TEXT NOT NULL DEFAULT '09:00',
    "horaHasta" TEXT NOT NULL DEFAULT '20:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionNotificaciones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfiguracionNotificaciones_tenantId_key"
    ON "ConfiguracionNotificaciones"("tenantId");

CREATE TABLE "NotificacionEvento" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "evento" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificacionEvento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificacionEvento_tenantId_evento_key"
    ON "NotificacionEvento"("tenantId", "evento");

CREATE TABLE "NotificacionWhatsapp" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "evento" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "clienteId" UUID,
    "ordenId" UUID,
    "cotizacionId" UUID,
    "claveUnica" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "plantilla" TEXT NOT NULL,
    "parametros" JSONB NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "motivo" TEXT,
    "programadaPara" TIMESTAMP(3),
    "enviadaEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacionWhatsapp_pkey" PRIMARY KEY ("id")
);

-- La idempotencia del módulo. Reabrir un paso devuelve una OT finalizada a
-- producción, así que sin este índice "tu orden está lista" sale dos veces.
CREATE UNIQUE INDEX "NotificacionWhatsapp_tenantId_claveUnica_key"
    ON "NotificacionWhatsapp"("tenantId", "claveUnica");

CREATE INDEX "NotificacionWhatsapp_tenantId_estado_programadaPara_idx"
    ON "NotificacionWhatsapp"("tenantId", "estado", "programadaPara");

CREATE INDEX "NotificacionWhatsapp_tenantId_createdAt_idx"
    ON "NotificacionWhatsapp"("tenantId", "createdAt");

ALTER TABLE "ConfiguracionNotificaciones" ADD CONSTRAINT "ConfiguracionNotificaciones_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificacionEvento" ADD CONSTRAINT "NotificacionEvento_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificacionWhatsapp" ADD CONSTRAINT "NotificacionWhatsapp_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
