-- E.1 — defaults declarados del paso (familia sugiere, producto pisa,
-- cotización ajusta). CREATE TABLE only.
CREATE TABLE "FamiliaPasoDefaults" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "familiaCodigo" TEXT NOT NULL,
    "centroCostoId" UUID,
    "productividadHora" DECIMAL(12,2),
    "tiempoFijoMin" DECIMAL(10,2),
    "demasiaMm" DECIMAL(8,2),
    "solapePanelMm" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamiliaPasoDefaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamiliaPasoDefaults_tenantId_familiaCodigo_key" ON "FamiliaPasoDefaults"("tenantId", "familiaCodigo");

ALTER TABLE "FamiliaPasoDefaults" ADD CONSTRAINT "FamiliaPasoDefaults_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FamiliaPasoDefaults" ADD CONSTRAINT "FamiliaPasoDefaults_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
