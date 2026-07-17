-- DropIndex
DROP INDEX "EstacionFamilia_tenantId_familiaCodigo_key";

-- CreateIndex
CREATE INDEX "EstacionFamilia_tenantId_familiaCodigo_idx" ON "EstacionFamilia"("tenantId", "familiaCodigo");

-- CreateIndex
CREATE UNIQUE INDEX "EstacionFamilia_estacionId_familiaCodigo_key" ON "EstacionFamilia"("estacionId", "familiaCodigo");

