-- Control plane, etapa C: impersonación auditada.
-- Ver docs/control-plane-diseno.md

-- CreateTable
CREATE TABLE "SesionImpersonacion" (
    "id" UUID NOT NULL,
    "staffUserId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "motivo" TEXT NOT NULL,
    "creadaEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEl" TIMESTAMP(3) NOT NULL,
    "cerradaEl" TIMESTAMP(3),
    "motivoCierre" TEXT,

    CONSTRAINT "SesionImpersonacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SesionImpersonacion_tenantId_creadaEl_idx" ON "SesionImpersonacion"("tenantId", "creadaEl");
CREATE INDEX "SesionImpersonacion_staffUserId_idx" ON "SesionImpersonacion"("staffUserId");

-- AlterTable: la membership de la sesión pasa a opcional (impersonación no
-- tiene), + el vínculo a la impersonación.
ALTER TABLE "AuthSession" ALTER COLUMN "currentMembershipId" DROP NOT NULL;
ALTER TABLE "AuthSession" ADD COLUMN "impersonacionId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_impersonacionId_key" ON "AuthSession"("impersonacionId");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_impersonacionId_fkey" FOREIGN KEY ("impersonacionId") REFERENCES "SesionImpersonacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
