ALTER TABLE "InboxConversacion" ADD COLUMN "responsableId" UUID, ADD COLUMN "responsableNombre" TEXT, ADD COLUMN "asignacionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InboxMensaje" ADD COLUMN "autorId" UUID, ADD COLUMN "autorNombre" TEXT;
ALTER TABLE "InboxEnvio" ADD COLUMN "usuarioNombre" TEXT;
CREATE TABLE "InboxEventoInterno" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "vinculoId" UUID NOT NULL, "conversacionId" UUID NOT NULL, "clave" UUID NOT NULL,
  "tipo" TEXT NOT NULL, "actorId" UUID NOT NULL, "actorNombre" TEXT NOT NULL, "texto" TEXT,
  "anteriorId" UUID, "anteriorNombre" TEXT, "responsableId" UUID, "responsableNombre" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboxEventoInterno_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InboxEventoInterno_conversacionId_vinculoId_tenantId_fkey" FOREIGN KEY ("conversacionId","vinculoId","tenantId") REFERENCES "InboxConversacion"("id","vinculoId","tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InboxEventoInterno_tipo_check" CHECK ("tipo" IN ('NOTA','ASIGNACION','TRANSFERENCIA','SIN_ASIGNAR','AUTOASIGNACION')),
  CONSTRAINT "InboxEventoInterno_nota_check" CHECK (("tipo"='NOTA' AND length(btrim("texto")) BETWEEN 1 AND 4000) OR ("tipo"<>'NOTA' AND "texto" IS NULL))
);
CREATE UNIQUE INDEX "InboxEventoInterno_tenantId_clave_key" ON "InboxEventoInterno"("tenantId","clave");
CREATE INDEX "InboxEventoInterno_tenantId_vinculoId_conversacionId_creat_idx" ON "InboxEventoInterno"("tenantId","vinculoId","conversacionId","createdAt","id");
CREATE INDEX "InboxEventoInterno_tenantId_vinculoId_conversacionId_actor_idx" ON "InboxEventoInterno"("tenantId","vinculoId","conversacionId","actorId","tipo");
CREATE INDEX "InboxConversacion_tenantId_vinculoId_responsableId_ultimo_idx" ON "InboxConversacion"("tenantId","vinculoId","responsableId","ultimoMensajeEl","id");
CREATE INDEX "InboxMensaje_tenantId_vinculoId_conversacionId_autorId_idx" ON "InboxMensaje"("tenantId","vinculoId","conversacionId","autorId");
-- Recuperar sólo la autoría acreditada por un envío propio. No asignar responsables retroactivamente.
UPDATE "InboxEnvio" e SET "usuarioNombre"=COALESCE(NULLIF(btrim(u."nombreCompleto"),''),u.email) FROM "User" u WHERE u.id=e."usuarioId";
UPDATE "InboxMensaje" m SET "autorId"=e."usuarioId", "autorNombre"=COALESCE(e."usuarioNombre",'Integrante anterior') FROM "InboxEnvio" e WHERE e."mensajeId"=m.id AND e."tenantId"=m."tenantId" AND e."vinculoId"=m."vinculoId";
