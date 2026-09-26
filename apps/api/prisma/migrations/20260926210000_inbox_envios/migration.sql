CREATE TABLE "InboxEnvio" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "vinculoId" UUID NOT NULL,
  "autorizacionId" UUID NOT NULL, "conversacionId" UUID NOT NULL, "usuarioId" UUID NOT NULL,
  "clave" UUID NOT NULL, "huella" TEXT NOT NULL, "texto" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'ENVIANDO', "codigo" TEXT, "wamid" TEXT, "mensajeId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InboxEnvio_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InboxEnvio_estado_check" CHECK ("estado" IN ('ENVIANDO','ACEPTADO','RECHAZADO','INCIERTO')),
  CONSTRAINT "InboxEnvio_conversacionId_vinculoId_tenantId_fkey" FOREIGN KEY ("conversacionId","vinculoId","tenantId") REFERENCES "InboxConversacion"("id","vinculoId","tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InboxEnvio_mensajeId_vinculoId_tenantId_fkey" FOREIGN KEY ("mensajeId","vinculoId","tenantId") REFERENCES "InboxMensaje"("id","vinculoId","tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InboxEnvio_tenantId_clave_key" ON "InboxEnvio"("tenantId","clave");
CREATE UNIQUE INDEX "InboxEnvio_vinculoId_wamid_key" ON "InboxEnvio"("vinculoId","wamid");
CREATE UNIQUE INDEX "InboxEnvio_mensajeId_key" ON "InboxEnvio"("mensajeId");
CREATE INDEX "InboxEnvio_tenantId_conversacionId_createdAt_idx" ON "InboxEnvio"("tenantId","conversacionId","createdAt");
CREATE UNIQUE INDEX "InboxEnvio_mensajeId_vinculoId_tenantId_key" ON "InboxEnvio"("mensajeId","vinculoId","tenantId");
