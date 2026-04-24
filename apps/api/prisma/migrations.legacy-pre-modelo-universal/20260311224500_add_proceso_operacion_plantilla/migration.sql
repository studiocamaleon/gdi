CREATE TABLE "ProcesoOperacionPlantilla" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "nombre" TEXT NOT NULL,
  "tipoOperacion" "TipoOperacionProceso" NOT NULL,
  "plantillaMaquinaria" "PlantillaMaquinaria",
  "setupMin" DECIMAL(12,2),
  "cleanupMin" DECIMAL(12,2),
  "modoProductividad" "ModoProductividadProceso" NOT NULL DEFAULT 'FIJA',
  "productividadBase" DECIMAL(12,4),
  "unidadEntrada" "UnidadProceso" NOT NULL DEFAULT 'NINGUNA',
  "unidadSalida" "UnidadProceso" NOT NULL DEFAULT 'NINGUNA',
  "unidadTiempo" "UnidadProceso" NOT NULL DEFAULT 'MINUTO',
  "mermaRunPct" DECIMAL(8,4),
  "reglaVelocidadJson" JSONB,
  "reglaMermaJson" JSONB,
  "observaciones" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProcesoOperacionPlantilla_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcesoOperacionPlantilla_tenantId_activo_idx" ON "ProcesoOperacionPlantilla"("tenantId", "activo");
CREATE INDEX "ProcesoOperacionPlantilla_tenantId_tipoOperacion_idx" ON "ProcesoOperacionPlantilla"("tenantId", "tipoOperacion");
CREATE INDEX "ProcesoOperacionPlantilla_tenantId_plantillaMaquinaria_idx" ON "ProcesoOperacionPlantilla"("tenantId", "plantillaMaquinaria");
CREATE INDEX "ProcesoOperacionPlantilla_tenantId_nombre_idx" ON "ProcesoOperacionPlantilla"("tenantId", "nombre");

ALTER TABLE "ProcesoOperacionPlantilla"
  ADD CONSTRAINT "ProcesoOperacionPlantilla_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
