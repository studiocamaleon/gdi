-- Permite conservar pasos históricos por versión de ruta sin romper ProductoConfigPaso.
ALTER TABLE "RutaPaso" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "RutaPaso_tenantId_rutaId_orden_key";
DROP INDEX IF EXISTS "RutaPaso_tenantId_rutaId_activo_idx";

CREATE UNIQUE INDEX "RutaPaso_tenantId_rutaId_version_orden_key"
  ON "RutaPaso"("tenantId", "rutaId", "version", "orden");

CREATE INDEX "RutaPaso_tenantId_rutaId_version_activo_idx"
  ON "RutaPaso"("tenantId", "rutaId", "version", "activo");
