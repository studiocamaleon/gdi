ALTER TYPE "PlantillaMaquinaria"
  ADD VALUE IF NOT EXISTS 'CORTE_HILO_CALIENTE';

CREATE TYPE "EstadoRevisionRecorridoVectorial" AS ENUM (
  'BORRADOR',
  'REVISADA',
  'APROBADA',
  'ENVIADA_MAQUINA',
  'REEMPLAZADA'
);

CREATE TABLE "RecorridoVectorialRevision" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "ordenTrabajoItemId" UUID NOT NULL,
  "placaIndice" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL,
  "modo" TEXT NOT NULL DEFAULT 'CORTE',
  "postprocesador" TEXT NOT NULL,
  "engineId" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "nombreArchivo" TEXT NOT NULL,
  "sourceSvg" TEXT NOT NULL,
  "linkedSvg" TEXT NOT NULL,
  "tap" TEXT NOT NULL,
  "routeJson" JSONB NOT NULL,
  "reportJson" JSONB NOT NULL,
  "metricsJson" JSONB NOT NULL,
  "machineProfileJson" JSONB NOT NULL,
  "estado" "EstadoRevisionRecorridoVectorial" NOT NULL DEFAULT 'BORRADOR',
  "creadaPorId" TEXT,
  "creadaPorNombre" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecorridoVectorialRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rv_revision_unq"
  ON "RecorridoVectorialRevision"("tenantId", "ordenTrabajoItemId", "placaIndice", "revision");
CREATE INDEX "rv_item_estado_idx"
  ON "RecorridoVectorialRevision"("tenantId", "ordenTrabajoItemId", "placaIndice", "estado");
CREATE INDEX "rv_source_hash_idx"
  ON "RecorridoVectorialRevision"("tenantId", "sourceHash");

ALTER TABLE "RecorridoVectorialRevision"
  ADD CONSTRAINT "RecorridoVectorialRevision_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecorridoVectorialRevision"
  ADD CONSTRAINT "RecorridoVectorialRevision_ordenTrabajoItemId_fkey"
  FOREIGN KEY ("ordenTrabajoItemId") REFERENCES "OrdenTrabajoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
