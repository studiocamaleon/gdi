-- AlterEnum
ALTER TYPE "ProveedorIntegracion" ADD VALUE 'META_WHATSAPP';

-- CreateTable
CREATE TABLE "WebhookWhatsappCrudo" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "tipo" TEXT NOT NULL,
    "wamid" TEXT,
    "phoneNumberId" TEXT,
    "payload" JSONB NOT NULL,
    "procesado" BOOLEAN NOT NULL DEFAULT false,
    "recibidoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookWhatsappCrudo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookWhatsappCrudo_tenantId_tipo_idx" ON "WebhookWhatsappCrudo"("tenantId", "tipo");

-- CreateIndex
CREATE INDEX "WebhookWhatsappCrudo_wamid_idx" ON "WebhookWhatsappCrudo"("wamid");

-- CreateIndex
CREATE INDEX "WebhookWhatsappCrudo_procesado_recibidoEl_idx" ON "WebhookWhatsappCrudo"("procesado", "recibidoEl");
