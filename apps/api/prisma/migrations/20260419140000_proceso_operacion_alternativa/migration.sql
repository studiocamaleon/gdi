-- P1.3.a — Alternativas de máquina+perfil por paso de producción.
-- Un paso puede declarar N opciones que el cliente elige al cotizar.

CREATE TABLE "ProcesoOperacionAlternativa" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "procesoOperacionId" UUID NOT NULL,
    "maquinaId" UUID NOT NULL,
    "perfilOperativoId" UUID,
    "label" TEXT NOT NULL,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProcesoOperacionAlternativa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcesoOperacionAlternativa_tenantId_procesoOperacionId_activo_idx"
    ON "ProcesoOperacionAlternativa"("tenantId", "procesoOperacionId", "activo");

CREATE INDEX "ProcesoOperacionAlternativa_tenantId_maquinaId_idx"
    ON "ProcesoOperacionAlternativa"("tenantId", "maquinaId");

CREATE INDEX "ProcesoOperacionAlternativa_tenantId_perfilOperativoId_idx"
    ON "ProcesoOperacionAlternativa"("tenantId", "perfilOperativoId");

ALTER TABLE "ProcesoOperacionAlternativa"
    ADD CONSTRAINT "ProcesoOperacionAlternativa_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacionAlternativa"
    ADD CONSTRAINT "ProcesoOperacionAlternativa_procesoOperacionId_fkey"
    FOREIGN KEY ("procesoOperacionId") REFERENCES "ProcesoOperacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacionAlternativa"
    ADD CONSTRAINT "ProcesoOperacionAlternativa_maquinaId_fkey"
    FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacionAlternativa"
    ADD CONSTRAINT "ProcesoOperacionAlternativa_perfilOperativoId_fkey"
    FOREIGN KEY ("perfilOperativoId") REFERENCES "MaquinaPerfilOperativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
