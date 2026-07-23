-- Control plane, etapa A: identidad de plataforma + auditoría.
-- Ver docs/control-plane-diseno.md

-- CreateEnum
CREATE TYPE "RolPlataforma" AS ENUM ('ADMIN', 'SOPORTE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "rolPlataforma" "RolPlataforma";

-- CreateTable
CREATE TABLE "PlataformaEvento" (
    "id" UUID NOT NULL,
    "staffUserId" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "tenantAfectadoId" UUID,
    "descripcion" TEXT NOT NULL,
    "datosJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlataformaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlataformaEvento_staffUserId_createdAt_idx" ON "PlataformaEvento"("staffUserId", "createdAt");

-- CreateIndex
CREATE INDEX "PlataformaEvento_tenantAfectadoId_idx" ON "PlataformaEvento"("tenantAfectadoId");

-- AddForeignKey
ALTER TABLE "PlataformaEvento" ADD CONSTRAINT "PlataformaEvento_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
