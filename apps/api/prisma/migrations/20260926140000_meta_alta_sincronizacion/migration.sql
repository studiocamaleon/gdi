-- CreateEnum
CREATE TYPE "EstadoAltaMeta" AS ENUM ('PENDIENTE', 'SUSCRIBIENDO', 'CONTACTOS_PENDIENTES', 'SOLICITANDO_CONTACTOS', 'HISTORIAL_PENDIENTE', 'SOLICITANDO_HISTORIAL', 'SOLICITUDES_COMPLETADAS', 'REVISION', 'PAUSADA');

-- AlterTable
ALTER TABLE "MetaAutorizacion" ADD COLUMN     "modo" TEXT NOT NULL DEFAULT 'COEXISTENCIA';

-- CreateTable
CREATE TABLE "MetaAlta" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "vinculoId" UUID NOT NULL,
    "autorizacionId" UUID NOT NULL,
    "appId" TEXT NOT NULL,
    "graphVersion" TEXT NOT NULL,
    "estado" "EstadoAltaMeta" NOT NULL DEFAULT 'PENDIENTE',
    "venceEl" TIMESTAMP(3) NOT NULL,
    "pasoIniciadoEl" TIMESTAMP(3),
    "contactosRequestId" TEXT,
    "historialRequestId" TEXT,
    "falloCodigo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAlta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaAlta_autorizacionId_key" ON "MetaAlta"("autorizacionId");

-- CreateIndex
CREATE INDEX "MetaAlta_estado_createdAt_idx" ON "MetaAlta"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "MetaAlta_tenantId_vinculoId_idx" ON "MetaAlta"("tenantId", "vinculoId");

-- AddForeignKey
ALTER TABLE "MetaAlta" ADD CONSTRAINT "MetaAlta_vinculoId_tenantId_fkey" FOREIGN KEY ("vinculoId", "tenantId") REFERENCES "MetaVinculo"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
