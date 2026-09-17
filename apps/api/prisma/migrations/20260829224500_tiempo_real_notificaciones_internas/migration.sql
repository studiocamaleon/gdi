CREATE TYPE "SeveridadNotificacionInterna" AS ENUM ('INFO', 'EXITO', 'ADVERTENCIA', 'CRITICA');

CREATE TABLE "EventoSistema" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "tipo" VARCHAR(100) NOT NULL,
    "entidadTipo" VARCHAR(60) NOT NULL,
    "entidadId" UUID,
    "actorUserId" UUID,
    "actorNombre" VARCHAR(200) NOT NULL,
    "titulo" VARCHAR(180) NOT NULL,
    "mensaje" VARCHAR(600) NOT NULL,
    "href" VARCHAR(500),
    "severidad" "SeveridadNotificacionInterna" NOT NULL DEFAULT 'INFO',
    "topicos" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoSistema_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificacionInterna" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "eventoId" BIGINT NOT NULL,
    "userId" UUID NOT NULL,
    "leidaEl" TIMESTAMP(3),
    "archivadaEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificacionInterna_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventoSistema_tenantId_id_idx" ON "EventoSistema"("tenantId", "id");
CREATE INDEX "EventoSistema_tenantId_createdAt_idx" ON "EventoSistema"("tenantId", "createdAt");
CREATE INDEX "EventoSistema_tenantId_entidadTipo_entidadId_idx" ON "EventoSistema"("tenantId", "entidadTipo", "entidadId");
CREATE UNIQUE INDEX "NotificacionInterna_eventoId_userId_key" ON "NotificacionInterna"("eventoId", "userId");
CREATE INDEX "NotificacionInterna_tenantId_userId_archivadaEl_leidaEl_createdAt_idx" ON "NotificacionInterna"("tenantId", "userId", "archivadaEl", "leidaEl", "createdAt");
CREATE INDEX "NotificacionInterna_tenantId_eventoId_idx" ON "NotificacionInterna"("tenantId", "eventoId");

ALTER TABLE "EventoSistema" ADD CONSTRAINT "EventoSistema_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventoSistema" ADD CONSTRAINT "EventoSistema_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificacionInterna" ADD CONSTRAINT "NotificacionInterna_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificacionInterna" ADD CONSTRAINT "NotificacionInterna_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoSistema"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificacionInterna" ADD CONSTRAINT "NotificacionInterna_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
