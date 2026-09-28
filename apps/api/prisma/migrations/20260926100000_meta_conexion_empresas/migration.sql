-- CreateEnum
CREATE TYPE "EstadoAutorizacionMeta" AS ENUM ('PREPARADA', 'CANJEANDO', 'CANJEADA', 'VERIFICANDO', 'VERIFICADA', 'CANCELADA', 'REINICIAR');

-- CreateEnum
CREATE TYPE "EstadoVinculoMeta" AS ENUM ('VERIFICADO', 'DESCONECTADO');

-- CreateTable
CREATE TABLE "MetaAutorizacion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "estadoHash" TEXT NOT NULL,
    "estado" "EstadoAutorizacionMeta" NOT NULL DEFAULT 'PREPARADA',
    "falloCodigo" TEXT,
    "appId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "graphVersion" TEXT NOT NULL,
    "tokenCifrado" JSONB,
    "venceEl" TIMESTAMP(3) NOT NULL,
    "canjeIniciadoEl" TIMESTAMP(3),
    "canjeadoEl" TIMESTAMP(3),
    "verificadaEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAutorizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaVinculo" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "wabaId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "estado" "EstadoVinculoMeta" NOT NULL DEFAULT 'VERIFICADO',
    "numero" TEXT NOT NULL,
    "nombreVerificado" TEXT,
    "tokenCifrado" JSONB,
    "tokenVenceEl" TIMESTAMP(3),
    "accesoDatosVenceEl" TIMESTAMP(3),
    "autorizacionId" UUID NOT NULL,
    "verificadoEl" TIMESTAMP(3) NOT NULL,
    "desconectadoEl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaVinculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaAutorizacion_estadoHash_key" ON "MetaAutorizacion"("estadoHash");

-- CreateIndex
CREATE INDEX "MetaAutorizacion_tenantId_sessionId_estado_idx" ON "MetaAutorizacion"("tenantId", "sessionId", "estado");

-- CreateIndex
CREATE INDEX "MetaAutorizacion_venceEl_estado_idx" ON "MetaAutorizacion"("venceEl", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "MetaVinculo_tenantId_key" ON "MetaVinculo"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaVinculo_wabaId_key" ON "MetaVinculo"("wabaId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaVinculo_phoneNumberId_key" ON "MetaVinculo"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaVinculo_autorizacionId_key" ON "MetaVinculo"("autorizacionId");

-- AddForeignKey
ALTER TABLE "MetaAutorizacion" ADD CONSTRAINT "MetaAutorizacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaVinculo" ADD CONSTRAINT "MetaVinculo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

