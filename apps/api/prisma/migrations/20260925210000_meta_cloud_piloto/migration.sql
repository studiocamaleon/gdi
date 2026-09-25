ALTER TABLE "NotificacionWhatsapp"
  ADD COLUMN "metaWamid" TEXT,
  ADD COLUMN "metaPhoneNumberId" TEXT,
  ADD COLUMN "estadoEntrega" TEXT,
  ADD COLUMN "estadoEntregaEl" TIMESTAMP(3),
  ADD COLUMN "metaErrorCodigo" TEXT;
CREATE UNIQUE INDEX "NotificacionWhatsapp_metaWamid_key" ON "NotificacionWhatsapp"("metaWamid");

ALTER TABLE "WebhookWhatsappCrudo"
  ADD COLUMN "wabaId" TEXT,
  ADD COLUMN "dedupClave" TEXT;
CREATE UNIQUE INDEX "WebhookWhatsappCrudo_dedupClave_key" ON "WebhookWhatsappCrudo"("dedupClave");
