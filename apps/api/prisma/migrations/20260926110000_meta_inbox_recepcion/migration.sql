-- CreateEnum
CREATE TYPE "EstadoTrabajoInbox" AS ENUM ('PENDIENTE', 'COMPLETADO', 'REVISION', 'PAUSADO');

-- AlterTable
ALTER TABLE "WebhookWhatsappCrudo" ADD COLUMN     "metaTimestamp" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MetaVinculo" ADD COLUMN     "recepcionDesdeEl" TIMESTAMP(3),
ADD COLUMN     "ultimoCambioCuentaEl" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InboxTrabajoEvento" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "vinculoId" UUID NOT NULL,
    "autorizacionId" UUID NOT NULL,
    "crudoId" UUID NOT NULL,
    "estado" "EstadoTrabajoInbox" NOT NULL DEFAULT 'PENDIENTE',
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER,
    "avisos" INTEGER NOT NULL DEFAULT 0,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "proximoIntentoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxTrabajoEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxImportacion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "vinculoId" UUID NOT NULL,
    "autorizacionId" UUID NOT NULL,
    "iniciadaEl" TIMESTAMP(3) NOT NULL,
    "progresoInformado" INTEGER NOT NULL DEFAULT 0,
    "finInformadoEl" TIMESTAMP(3),
    "historialRechazado" BOOLEAN NOT NULL DEFAULT false,
    "necesitaRevision" BOOLEAN NOT NULL DEFAULT false,
    "ultimoEventoEl" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxImportacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxConversacion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "vinculoId" UUID NOT NULL,
    "contactoWaId" TEXT NOT NULL,
    "ultimoMensajeEl" TIMESTAMP(3),
    "ultimoEntranteNuevoEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxConversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxBloqueHistorial" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "vinculoId" UUID NOT NULL,
    "autorizacionId" UUID NOT NULL,
    "fase" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "progreso" INTEGER NOT NULL,
    "procesadoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxBloqueHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxMensaje" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "vinculoId" UUID NOT NULL,
    "wamid" TEXT NOT NULL,
    "conversacionId" UUID,
    "direccion" TEXT,
    "enviadoEl" TIMESTAMP(3),
    "tipo" TEXT,
    "contenido" JSONB,
    "prioridadContenido" INTEGER NOT NULL DEFAULT 0,
    "edicionEl" TIMESTAMP(3),
    "revocadoEl" TIMESTAMP(3),
    "estadoEntrega" TEXT,
    "estadoEntregaOrden" INTEGER NOT NULL DEFAULT 0,
    "estadoEntregaEl" TIMESTAMP(3),
    "delHistorial" BOOLEAN NOT NULL DEFAULT false,
    "delCelular" BOOLEAN NOT NULL DEFAULT false,
    "entranteNuevo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxMensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxContacto" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "vinculoId" UUID NOT NULL,
    "waId" TEXT NOT NULL,
    "nombre" TEXT,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "actualizadoMetaEl" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxContacto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboxTrabajoEvento_crudoId_key" ON "InboxTrabajoEvento"("crudoId");

-- CreateIndex
CREATE INDEX "InboxTrabajoEvento_estado_proximoIntentoEl_prioridad_create_idx" ON "InboxTrabajoEvento"("estado", "proximoIntentoEl", "prioridad", "createdAt");

-- CreateIndex
CREATE INDEX "InboxTrabajoEvento_tenantId_vinculoId_autorizacionId_idx" ON "InboxTrabajoEvento"("tenantId", "vinculoId", "autorizacionId");

-- CreateIndex
CREATE INDEX "InboxImportacion_tenantId_idx" ON "InboxImportacion"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxImportacion_vinculoId_autorizacionId_key" ON "InboxImportacion"("vinculoId", "autorizacionId");

-- CreateIndex
CREATE INDEX "InboxConversacion_tenantId_ultimoMensajeEl_id_idx" ON "InboxConversacion"("tenantId", "ultimoMensajeEl", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InboxConversacion_vinculoId_contactoWaId_key" ON "InboxConversacion"("vinculoId", "contactoWaId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxConversacion_id_vinculoId_tenantId_key" ON "InboxConversacion"("id", "vinculoId", "tenantId");

-- CreateIndex
CREATE INDEX "InboxBloqueHistorial_tenantId_idx" ON "InboxBloqueHistorial"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxBloqueHistorial_canal_bloque_key" ON "InboxBloqueHistorial"("vinculoId", "autorizacionId", "fase", "orden");

-- CreateIndex
CREATE INDEX "InboxMensaje_tenantId_conversacionId_enviadoEl_id_idx" ON "InboxMensaje"("tenantId", "conversacionId", "enviadoEl", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InboxMensaje_vinculoId_wamid_key" ON "InboxMensaje"("vinculoId", "wamid");

-- CreateIndex
CREATE INDEX "InboxContacto_tenantId_idx" ON "InboxContacto"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxContacto_vinculoId_waId_key" ON "InboxContacto"("vinculoId", "waId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaVinculo_id_tenantId_key" ON "MetaVinculo"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "InboxTrabajoEvento" ADD CONSTRAINT "InboxTrabajoEvento_crudoId_fkey" FOREIGN KEY ("crudoId") REFERENCES "WebhookWhatsappCrudo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxTrabajoEvento" ADD CONSTRAINT "InboxTrabajoEvento_vinculoId_tenantId_fkey" FOREIGN KEY ("vinculoId", "tenantId") REFERENCES "MetaVinculo"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxImportacion" ADD CONSTRAINT "InboxImportacion_vinculoId_tenantId_fkey" FOREIGN KEY ("vinculoId", "tenantId") REFERENCES "MetaVinculo"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxConversacion" ADD CONSTRAINT "InboxConversacion_vinculoId_tenantId_fkey" FOREIGN KEY ("vinculoId", "tenantId") REFERENCES "MetaVinculo"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxBloqueHistorial" ADD CONSTRAINT "InboxBloqueHistorial_vinculoId_tenantId_fkey" FOREIGN KEY ("vinculoId", "tenantId") REFERENCES "MetaVinculo"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMensaje" ADD CONSTRAINT "InboxMensaje_vinculoId_tenantId_fkey" FOREIGN KEY ("vinculoId", "tenantId") REFERENCES "MetaVinculo"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMensaje" ADD CONSTRAINT "InboxMensaje_conversacionId_vinculoId_tenantId_fkey" FOREIGN KEY ("conversacionId", "vinculoId", "tenantId") REFERENCES "InboxConversacion"("id", "vinculoId", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxContacto" ADD CONSTRAINT "InboxContacto_vinculoId_tenantId_fkey" FOREIGN KEY ("vinculoId", "tenantId") REFERENCES "MetaVinculo"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
