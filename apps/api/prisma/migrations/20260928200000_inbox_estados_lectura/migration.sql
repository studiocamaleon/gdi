ALTER TABLE "InboxConversacion"
  ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
  ADD COLUMN "estadoVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "resueltaEl" TIMESTAMP(3),
  ADD COLUMN "entrantesRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "leidaRevision" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "InboxConversacion_estado_check" CHECK ("estado" IN ('ACTIVA','RESUELTA'));
ALTER TABLE "InboxEventoInterno" ALTER COLUMN "actorId" DROP NOT NULL;
ALTER TABLE "InboxEventoInterno" DROP CONSTRAINT "InboxEventoInterno_tipo_check";
ALTER TABLE "InboxEventoInterno" ADD CONSTRAINT "InboxEventoInterno_tipo_check" CHECK ("tipo" IN ('NOTA','ASIGNACION','TRANSFERENCIA','SIN_ASIGNAR','AUTOASIGNACION','RESUELTA','REABIERTA','REABIERTA_CLIENTE'));
-- Los mensajes previos quedan pendientes de lectura del equipo; no se presume que alguien los vio.
UPDATE "InboxConversacion" c SET "entrantesRevision"=(SELECT count(*)::integer FROM "InboxMensaje" m WHERE m."tenantId"=c."tenantId" AND m."vinculoId"=c."vinculoId" AND m."conversacionId"=c.id AND m.direccion='ENTRANTE');
