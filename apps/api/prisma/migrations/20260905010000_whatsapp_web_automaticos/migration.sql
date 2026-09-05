ALTER TABLE "ConfiguracionNotificaciones"
 ADD COLUMN "canalOrdenes" TEXT NOT NULL DEFAULT 'WATI',
 ADD COLUMN "whatsappWebDispositivoId" UUID,
 ADD COLUMN "whatsappWebNumero" TEXT,
 ADD COLUMN "whatsappWebDesde" TIMESTAMP(3);
ALTER TABLE "NotificacionWhatsapp"
 ADD COLUMN "canal" TEXT NOT NULL DEFAULT 'WATI',
 ADD COLUMN "textoWeb" TEXT,
 ADD COLUMN "reservaToken" UUID,
 ADD COLUMN "mensajeWebId" TEXT;
