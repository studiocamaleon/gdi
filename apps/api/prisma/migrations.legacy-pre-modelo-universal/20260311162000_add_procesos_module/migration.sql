-- Create enums for procesos module
CREATE TYPE "EstadoConfiguracionProceso" AS ENUM ('BORRADOR', 'INCOMPLETA', 'LISTA');
CREATE TYPE "TipoOperacionProceso" AS ENUM (
  'PREFLIGHT',
  'PREPRENSA',
  'IMPRESION',
  'CORTE',
  'MECANIZADO',
  'GRABADO',
  'TERMINACION',
  'CURADO',
  'LAMINADO',
  'TRANSFERENCIA',
  'CONTROL_CALIDAD',
  'EMPAQUE',
  'LOGISTICA',
  'TERCERIZADO',
  'OTRO'
);
CREATE TYPE "ModoProductividadProceso" AS ENUM ('FIJA', 'FORMULA', 'TABLA');

-- Create process definition table
CREATE TABLE "ProcesoDefinicion" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "plantillaMaquinaria" "PlantillaMaquinaria" NOT NULL,
  "plantillaVersion" INTEGER NOT NULL DEFAULT 1,
  "estadoConfiguracion" "EstadoConfiguracionProceso" NOT NULL DEFAULT 'BORRADOR',
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "observaciones" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcesoDefinicion_pkey" PRIMARY KEY ("id")
);

-- Create process operations table
CREATE TABLE "ProcesoOperacion" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "procesoDefinicionId" UUID NOT NULL,
  "orden" INTEGER NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "tipoOperacion" "TipoOperacionProceso" NOT NULL,
  "centroCostoId" UUID NOT NULL,
  "maquinaId" UUID,
  "perfilOperativoId" UUID,
  "setupMin" DECIMAL(12,2),
  "runMin" DECIMAL(12,2),
  "cleanupMin" DECIMAL(12,2),
  "tiempoFijoMin" DECIMAL(12,2),
  "modoProductividad" "ModoProductividadProceso" NOT NULL DEFAULT 'FIJA',
  "productividadBase" DECIMAL(12,4),
  "unidadEntrada" TEXT,
  "unidadSalida" TEXT,
  "mermaSetup" DECIMAL(8,4),
  "mermaRunPct" DECIMAL(8,4),
  "reglaVelocidadJson" JSONB,
  "reglaMermaJson" JSONB,
  "detalleJson" JSONB,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcesoOperacion_pkey" PRIMARY KEY ("id")
);

-- Indexes and unique constraints
CREATE UNIQUE INDEX "ProcesoDefinicion_tenantId_codigo_key" ON "ProcesoDefinicion"("tenantId", "codigo");
CREATE INDEX "ProcesoDefinicion_tenantId_plantillaMaquinaria_activo_idx" ON "ProcesoDefinicion"("tenantId", "plantillaMaquinaria", "activo");
CREATE INDEX "ProcesoDefinicion_tenantId_estadoConfiguracion_idx" ON "ProcesoDefinicion"("tenantId", "estadoConfiguracion");
CREATE INDEX "ProcesoDefinicion_tenantId_nombre_idx" ON "ProcesoDefinicion"("tenantId", "nombre");

CREATE UNIQUE INDEX "ProcesoOperacion_tenantId_procesoDefinicionId_orden_key" ON "ProcesoOperacion"("tenantId", "procesoDefinicionId", "orden");
CREATE UNIQUE INDEX "ProcesoOperacion_tenantId_procesoDefinicionId_codigo_key" ON "ProcesoOperacion"("tenantId", "procesoDefinicionId", "codigo");
CREATE INDEX "ProcesoOperacion_tenantId_procesoDefinicionId_activo_idx" ON "ProcesoOperacion"("tenantId", "procesoDefinicionId", "activo");
CREATE INDEX "ProcesoOperacion_tenantId_centroCostoId_idx" ON "ProcesoOperacion"("tenantId", "centroCostoId");
CREATE INDEX "ProcesoOperacion_tenantId_maquinaId_idx" ON "ProcesoOperacion"("tenantId", "maquinaId");
CREATE INDEX "ProcesoOperacion_tenantId_perfilOperativoId_idx" ON "ProcesoOperacion"("tenantId", "perfilOperativoId");

-- Foreign keys
ALTER TABLE "ProcesoDefinicion"
ADD CONSTRAINT "ProcesoDefinicion_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacion"
ADD CONSTRAINT "ProcesoOperacion_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacion"
ADD CONSTRAINT "ProcesoOperacion_procesoDefinicionId_fkey"
FOREIGN KEY ("procesoDefinicionId") REFERENCES "ProcesoDefinicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacion"
ADD CONSTRAINT "ProcesoOperacion_centroCostoId_fkey"
FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacion"
ADD CONSTRAINT "ProcesoOperacion_maquinaId_fkey"
FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacion"
ADD CONSTRAINT "ProcesoOperacion_perfilOperativoId_fkey"
FOREIGN KEY ("perfilOperativoId") REFERENCES "MaquinaPerfilOperativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
