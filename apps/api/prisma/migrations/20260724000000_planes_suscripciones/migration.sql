-- Control plane, etapa B1: planes, suscripciones e invitaciones de
-- plataforma. Ver docs/control-plane-diseno.md

-- AlterTable: invitaciones emitidas desde el control plane no tienen sender.
ALTER TABLE "Invitation" ALTER COLUMN "invitedByMembershipId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioMensual" DECIMAL(14,2) NOT NULL,
    "featuresJson" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suscripcion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_codigo_key" ON "Plan"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Suscripcion_tenantId_key" ON "Suscripcion"("tenantId");

-- CreateIndex
CREATE INDEX "Suscripcion_planId_idx" ON "Suscripcion"("planId");

-- AddForeignKey
ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed del catálogo (idempotente): los cuatro planes del diseño. Los precios
-- y features se administran después desde la consola; esto es el arranque.
INSERT INTO "Plan" ("id", "codigo", "nombre", "precioMensual", "featuresJson", "orden") VALUES
  (gen_random_uuid(), 'trial',    'Trial',    0,      '{"afip": false, "whatsapp": false, "usuariosMax": 3,  "ordenesMesMax": 50,   "storageGb": 2}',   0),
  (gen_random_uuid(), 'taller',   'Taller',   89000,  '{"afip": false, "whatsapp": true,  "usuariosMax": 6,  "ordenesMesMax": 300,  "storageGb": 20}',  1),
  (gen_random_uuid(), 'estudio',  'Estudio',  189000, '{"afip": true,  "whatsapp": true,  "usuariosMax": 15, "ordenesMesMax": 1200, "storageGb": 100}', 2),
  (gen_random_uuid(), 'diamante', 'Diamante', 359000, '{"afip": true,  "whatsapp": true,  "usuariosMax": 40, "ordenesMesMax": 5000, "storageGb": 500}', 3)
ON CONFLICT ("codigo") DO NOTHING;
