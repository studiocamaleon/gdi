-- Registro de primera lectura. No se atribuye retroactivamente una firma
-- a las lecturas anteriores, porque no se guardaba el actor real.
CREATE TABLE "EventoSistemaLectura" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "eventoId" BIGINT NOT NULL,
  "notificacionId" UUID,
  "lectorUserId" UUID,
  "lectorNombre" VARCHAR(200) NOT NULL,
  "leidaEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventoSistemaLectura_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventoSistemaLectura_notificacionId_key" ON "EventoSistemaLectura"("notificacionId");
CREATE INDEX "EventoSistemaLectura_tenantId_eventoId_leidaEl_idx" ON "EventoSistemaLectura"("tenantId", "eventoId", "leidaEl");
ALTER TABLE "EventoSistemaLectura" ADD CONSTRAINT "EventoSistemaLectura_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventoSistemaLectura" ADD CONSTRAINT "EventoSistemaLectura_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoSistema"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventoSistemaLectura" ADD CONSTRAINT "EventoSistemaLectura_notificacionId_fkey" FOREIGN KEY ("notificacionId") REFERENCES "NotificacionInterna"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventoSistemaLectura" ADD CONSTRAINT "EventoSistemaLectura_lectorUserId_fkey" FOREIGN KEY ("lectorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafo_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "EventoSistemaLectura" TO grafo_app;
  END IF;
END $$;
