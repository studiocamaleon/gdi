ALTER TABLE "NotificacionWhatsapp" ADD COLUMN "watiMensajeId" TEXT, ADD COLUMN "watiConsultaEl" TIMESTAMP(3);
CREATE INDEX "NotificacionWhatsapp_wati_seguimiento_idx" ON "NotificacionWhatsapp" ("canal", "estado", "watiConsultaEl");
