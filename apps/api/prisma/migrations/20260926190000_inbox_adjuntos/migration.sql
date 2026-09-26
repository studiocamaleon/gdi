ALTER TYPE "ArchivoScope" ADD VALUE 'INBOX';
CREATE UNIQUE INDEX "InboxMensaje_id_vinculoId_tenantId_key" ON "InboxMensaje"("id", "vinculoId", "tenantId");
CREATE TABLE "InboxAdjunto" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "vinculoId" UUID NOT NULL,
  "mensajeId" UUID NOT NULL, "autorizacionId" UUID NOT NULL, "mediaId" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE', "intentos" INTEGER NOT NULL DEFAULT 0,
  "proximoIntentoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bloqueoId" UUID, "bloqueoHasta" TIMESTAMP(3), "falloCodigo" TEXT, "archivoId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InboxAdjunto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InboxAdjunto_estado_check" CHECK ("estado" IN ('PENDIENTE','DESCARGANDO','LISTO','NO_DISPONIBLE','REVISION','RETIRADO')),
  CONSTRAINT "InboxAdjunto_mensajeId_vinculoId_tenantId_fkey" FOREIGN KEY ("mensajeId", "vinculoId", "tenantId") REFERENCES "InboxMensaje"("id","vinculoId","tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InboxAdjunto_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "Archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InboxAdjunto_mensajeId_key" ON "InboxAdjunto"("mensajeId");
CREATE UNIQUE INDEX "InboxAdjunto_archivoId_key" ON "InboxAdjunto"("archivoId");
CREATE INDEX "InboxAdjunto_estado_proximoIntentoEl_idx" ON "InboxAdjunto"("estado","proximoIntentoEl");
CREATE INDEX "InboxAdjunto_tenantId_vinculoId_idx" ON "InboxAdjunto"("tenantId","vinculoId");

CREATE UNIQUE INDEX "InboxAdjunto_mensajeId_vinculoId_tenantId_key" ON "InboxAdjunto"("mensajeId","vinculoId","tenantId");
CREATE FUNCTION verificar_archivo_inbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."archivoId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Archivo" WHERE id=NEW."archivoId" AND "tenantId"=NEW."tenantId" AND scope::text='INBOX' AND generado AND NOT publico
  ) THEN RAISE EXCEPTION 'Archivo de Inbox fuera de empresa o privado' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "InboxAdjunto_archivo_propio" BEFORE INSERT OR UPDATE ON "InboxAdjunto" FOR EACH ROW EXECUTE FUNCTION verificar_archivo_inbox();
