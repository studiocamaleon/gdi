-- Fase 2 Visual Ilusión: control documental, aprobaciones y gates.
-- Expand-only: no modifica adjuntos ni órdenes existentes.

CREATE TYPE "PropositoArchivoMaestro" AS ENUM ('PRINT', 'CUT', 'RENDER', 'PLANO', 'INSTRUCTIVO', 'OTRO');
CREATE TYPE "EtapaDesarrolloDocumento" AS ENUM ('BRIEF', 'DISENO', 'PROTOTIPO', 'MUESTRA', 'PRODUCCION');
CREATE TYPE "EstadoRevisionArchivo" AS ENUM ('BORRADOR', 'EN_REVISION', 'OBSERVADA', 'APROBADA', 'OBSOLETA');
CREATE TYPE "TipoAprobacionDocumento" AS ENUM ('CLIENTE', 'DISENO', 'COLOR_MUESTRA', 'INGENIERIA', 'LIBERACION_PRODUCTIVA');
CREATE TYPE "EstadoSolicitudAprobacion" AS ENUM ('PENDIENTE', 'APROBADA', 'OBSERVADA', 'RECHAZADA', 'CANCELADA');
CREATE TYPE "DecisionAprobacionDocumento" AS ENUM ('APROBAR', 'OBSERVAR', 'RECHAZAR', 'CANCELAR');

ALTER TYPE "TipoEnlacePublico" ADD VALUE 'APROBACION_DOCUMENTAL';

CREATE TABLE "ArchivoMaestro" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "proyectoCampanaId" UUID NOT NULL,
  "nombre" VARCHAR(180) NOT NULL,
  "proposito" "PropositoArchivoMaestro" NOT NULL,
  "etapa" "EtapaDesarrolloDocumento" NOT NULL,
  "descripcion" VARCHAR(1000),
  "requerido" BOOLEAN NOT NULL DEFAULT true,
  "creadoPorId" UUID,
  "creadoPorNombre" VARCHAR(200) NOT NULL,
  "revisionAprobadaId" UUID,
  "revisionLiberadaId" UUID,
  "liberadaEl" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArchivoMaestro_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArchivoRevision" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "archivoMaestroId" UUID NOT NULL,
  "archivoId" UUID NOT NULL,
  "numero" INTEGER NOT NULL,
  "estado" "EstadoRevisionArchivo" NOT NULL DEFAULT 'BORRADOR',
  "comentario" VARCHAR(1500),
  "hash" TEXT,
  "autorUserId" UUID,
  "autorNombre" VARCHAR(200) NOT NULL,
  "liberadaPorId" UUID,
  "liberadaPorNombre" VARCHAR(200),
  "liberadaEl" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArchivoRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SolicitudAprobacionDocumento" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "revisionId" UUID NOT NULL,
  "tipo" "TipoAprobacionDocumento" NOT NULL,
  "estado" "EstadoSolicitudAprobacion" NOT NULL DEFAULT 'PENDIENTE',
  "comentario" VARCHAR(1500),
  "solicitadaPorId" UUID,
  "solicitadaPorNombre" VARCHAR(200) NOT NULL,
  "asignadaAUsuarioId" UUID,
  "asignadaARol" "RolSistema",
  "permiteDecisionExterna" BOOLEAN NOT NULL DEFAULT false,
  "expiraEl" TIMESTAMP(3),
  "resueltaEl" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SolicitudAprobacionDocumento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DecisionAprobacionDocumentoRegistro" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "solicitudId" UUID NOT NULL,
  "decision" "DecisionAprobacionDocumento" NOT NULL,
  "comentario" VARCHAR(2000),
  "evidenciaArchivoId" UUID,
  "actorUserId" UUID,
  "actorNombre" VARCHAR(200) NOT NULL,
  "actorRol" VARCHAR(80),
  "origen" VARCHAR(20) NOT NULL DEFAULT 'INTERNO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecisionAprobacionDocumentoRegistro_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GateProduccionDocumento" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "proyectoCampanaId" UUID NOT NULL,
  "ordenId" UUID NOT NULL,
  "pasoId" UUID,
  "archivoMaestroId" UUID NOT NULL,
  "tipoAprobacion" "TipoAprobacionDocumento" NOT NULL,
  "nombre" VARCHAR(180) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GateProduccionDocumento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArchivoMaestro_revisionAprobadaId_key" ON "ArchivoMaestro"("revisionAprobadaId");
CREATE UNIQUE INDEX "ArchivoMaestro_revisionLiberadaId_key" ON "ArchivoMaestro"("revisionLiberadaId");
CREATE INDEX "ArchivoMaestro_tenantId_proyectoCampanaId_etapa_idx" ON "ArchivoMaestro"("tenantId", "proyectoCampanaId", "etapa");
CREATE UNIQUE INDEX "ArchivoMaestro_tenantId_proyectoCampanaId_nombre_key" ON "ArchivoMaestro"("tenantId", "proyectoCampanaId", "nombre");
CREATE UNIQUE INDEX "ArchivoRevision_archivoId_key" ON "ArchivoRevision"("archivoId");
CREATE INDEX "ArchivoRevision_tenantId_archivoMaestroId_createdAt_idx" ON "ArchivoRevision"("tenantId", "archivoMaestroId", "createdAt");
CREATE INDEX "ArchivoRevision_tenantId_estado_idx" ON "ArchivoRevision"("tenantId", "estado");
CREATE UNIQUE INDEX "ArchivoRevision_archivoMaestroId_numero_key" ON "ArchivoRevision"("archivoMaestroId", "numero");
CREATE INDEX "SolicitudAprobacionDocumento_tenantId_estado_createdAt_idx" ON "SolicitudAprobacionDocumento"("tenantId", "estado", "createdAt");
CREATE INDEX "SolicitudAprobacionDocumento_tenantId_revisionId_tipo_idx" ON "SolicitudAprobacionDocumento"("tenantId", "revisionId", "tipo");
CREATE UNIQUE INDEX "SolicitudAprobacionDocumento_pendiente_unica_idx" ON "SolicitudAprobacionDocumento"("revisionId", "tipo") WHERE "estado" = 'PENDIENTE';
CREATE INDEX "DecisionAprobacionDocumentoRegistro_tenantId_solicitudId_cr_idx" ON "DecisionAprobacionDocumentoRegistro"("tenantId", "solicitudId", "createdAt");
CREATE INDEX "DecisionAprobacionDocumentoRegistro_tenantId_actorUserId_cr_idx" ON "DecisionAprobacionDocumentoRegistro"("tenantId", "actorUserId", "createdAt");
CREATE INDEX "GateProduccionDocumento_tenantId_ordenId_activo_idx" ON "GateProduccionDocumento"("tenantId", "ordenId", "activo");
CREATE INDEX "GateProduccionDocumento_tenantId_pasoId_activo_idx" ON "GateProduccionDocumento"("tenantId", "pasoId", "activo");
CREATE INDEX "GateProduccionDocumento_tenantId_proyectoCampanaId_idx" ON "GateProduccionDocumento"("tenantId", "proyectoCampanaId");
CREATE UNIQUE INDEX "GateProduccionDocumento_ordenId_pasoId_archivoMaestroId_tip_key" ON "GateProduccionDocumento"("ordenId", "pasoId", "archivoMaestroId", "tipoAprobacion");
CREATE UNIQUE INDEX "GateProduccionDocumento_orden_maestro_tipo_sin_paso_key" ON "GateProduccionDocumento"("ordenId", "archivoMaestroId", "tipoAprobacion") WHERE "pasoId" IS NULL;

ALTER TABLE "ArchivoMaestro" ADD CONSTRAINT "ArchivoMaestro_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchivoMaestro" ADD CONSTRAINT "ArchivoMaestro_proyectoCampanaId_fkey" FOREIGN KEY ("proyectoCampanaId") REFERENCES "ProyectoCampana"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchivoMaestro" ADD CONSTRAINT "ArchivoMaestro_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArchivoMaestro" ADD CONSTRAINT "ArchivoMaestro_revisionAprobadaId_fkey" FOREIGN KEY ("revisionAprobadaId") REFERENCES "ArchivoRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArchivoMaestro" ADD CONSTRAINT "ArchivoMaestro_revisionLiberadaId_fkey" FOREIGN KEY ("revisionLiberadaId") REFERENCES "ArchivoRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArchivoRevision" ADD CONSTRAINT "ArchivoRevision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchivoRevision" ADD CONSTRAINT "ArchivoRevision_archivoMaestroId_fkey" FOREIGN KEY ("archivoMaestroId") REFERENCES "ArchivoMaestro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchivoRevision" ADD CONSTRAINT "ArchivoRevision_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "Archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchivoRevision" ADD CONSTRAINT "ArchivoRevision_autorUserId_fkey" FOREIGN KEY ("autorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArchivoRevision" ADD CONSTRAINT "ArchivoRevision_liberadaPorId_fkey" FOREIGN KEY ("liberadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SolicitudAprobacionDocumento" ADD CONSTRAINT "SolicitudAprobacionDocumento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SolicitudAprobacionDocumento" ADD CONSTRAINT "SolicitudAprobacionDocumento_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ArchivoRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SolicitudAprobacionDocumento" ADD CONSTRAINT "SolicitudAprobacionDocumento_solicitadaPorId_fkey" FOREIGN KEY ("solicitadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SolicitudAprobacionDocumento" ADD CONSTRAINT "SolicitudAprobacionDocumento_asignadaAUsuarioId_fkey" FOREIGN KEY ("asignadaAUsuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DecisionAprobacionDocumentoRegistro" ADD CONSTRAINT "DecisionAprobacionDocumentoRegistro_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DecisionAprobacionDocumentoRegistro" ADD CONSTRAINT "DecisionAprobacionDocumentoRegistro_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudAprobacionDocumento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DecisionAprobacionDocumentoRegistro" ADD CONSTRAINT "DecisionAprobacionDocumentoRegistro_evidenciaArchivoId_fkey" FOREIGN KEY ("evidenciaArchivoId") REFERENCES "Archivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DecisionAprobacionDocumentoRegistro" ADD CONSTRAINT "DecisionAprobacionDocumentoRegistro_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GateProduccionDocumento" ADD CONSTRAINT "GateProduccionDocumento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GateProduccionDocumento" ADD CONSTRAINT "GateProduccionDocumento_proyectoCampanaId_fkey" FOREIGN KEY ("proyectoCampanaId") REFERENCES "ProyectoCampana"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GateProduccionDocumento" ADD CONSTRAINT "GateProduccionDocumento_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GateProduccionDocumento" ADD CONSTRAINT "GateProduccionDocumento_pasoId_fkey" FOREIGN KEY ("pasoId") REFERENCES "OrdenTrabajoItemPaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GateProduccionDocumento" ADD CONSTRAINT "GateProduccionDocumento_archivoMaestroId_fkey" FOREIGN KEY ("archivoMaestroId") REFERENCES "ArchivoMaestro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
