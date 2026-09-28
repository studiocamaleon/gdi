CREATE TABLE "InboxCarga" (
 "archivoId" UUID NOT NULL, "tenantId" UUID NOT NULL, "vinculoId" UUID NOT NULL,
 "autorizacionId" UUID NOT NULL, "conversacionId" UUID NOT NULL, "usuarioId" UUID NOT NULL,
 "envioId" UUID, "voz" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "InboxCarga_pkey" PRIMARY KEY ("archivoId"),
 CONSTRAINT "InboxCarga_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "Archivo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "InboxCarga_conversacionId_vinculoId_tenantId_fkey" FOREIGN KEY ("conversacionId","vinculoId","tenantId") REFERENCES "InboxConversacion"("id","vinculoId","tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "InboxCarga_envioId_fkey" FOREIGN KEY ("envioId") REFERENCES "InboxEnvio"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InboxCarga_envioId_key" ON "InboxCarga"("envioId");
CREATE INDEX "InboxCarga_tenantId_conversacionId_createdAt_idx" ON "InboxCarga"("tenantId","conversacionId","createdAt");
ALTER TABLE "InboxEnvio" DROP CONSTRAINT "InboxEnvio_tipo_check";
ALTER TABLE "InboxEnvio" ADD CONSTRAINT "InboxEnvio_tipo_check" CHECK ("tipo" IN ('TEXTO','PLANTILLA','MEDIO'));
