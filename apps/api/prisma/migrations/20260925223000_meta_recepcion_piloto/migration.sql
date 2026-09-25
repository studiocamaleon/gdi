CREATE TABLE "MensajeWhatsappRecibido" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "wabaId" TEXT NOT NULL,
  "phoneNumberId" TEXT NOT NULL,
  "wamid" TEXT NOT NULL,
  "remitente" TEXT NOT NULL,
  "nombreContacto" TEXT,
  "tipo" TEXT NOT NULL,
  "texto" TEXT,
  "enviadoEl" TIMESTAMP(3) NOT NULL,
  "recibidoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MensajeWhatsappRecibido_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MensajeWhatsappRecibido_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MensajeWhatsappRecibido_wabaId_phoneNumberId_wamid_key"
  ON "MensajeWhatsappRecibido"("wabaId", "phoneNumberId", "wamid");
CREATE INDEX "MensajeWhatsappRecibido_bandeja_idx"
  ON "MensajeWhatsappRecibido"("tenantId", "wabaId", "phoneNumberId", "remitente", "enviadoEl", "id");
