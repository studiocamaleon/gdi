-- Fase 4: topología productiva versionada y dependencias de ejecución.
CREATE TYPE "TopologiaProduccion" AS ENUM ('LINEAL', 'DAG');

ALTER TABLE "ProductoRecetaRevision"
  ADD COLUMN "topologiaProduccion" "TopologiaProduccion" NOT NULL DEFAULT 'LINEAL',
  ADD COLUMN "grafoProduccionJson" JSONB;

ALTER TABLE "OrdenTrabajoItem"
  ADD COLUMN "topologiaProduccion" "TopologiaProduccion" NOT NULL DEFAULT 'LINEAL',
  ADD COLUMN "grafoProduccionSnapshotJson" JSONB;

ALTER TABLE "OrdenTrabajoItemPaso"
  ADD COLUMN "nodoClave" VARCHAR(160),
  ADD COLUMN "esTerminal" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "OrdenTrabajoItemPaso_itemId_nodoClave_key"
  ON "OrdenTrabajoItemPaso"("itemId", "nodoClave");

CREATE TABLE "OrdenTrabajoPasoDependencia" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "ordenId" UUID NOT NULL,
  "predecesorPasoId" UUID NOT NULL,
  "sucesorPasoId" UUID NOT NULL,
  "tipo" VARCHAR(40) NOT NULL DEFAULT 'precedencia',
  "obligatoria" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrdenTrabajoPasoDependencia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrdenTrabajoPasoDependencia_predecesorPasoId_sucesorPasoId_key"
  ON "OrdenTrabajoPasoDependencia"("predecesorPasoId", "sucesorPasoId");
CREATE INDEX "OrdenTrabajoPasoDependencia_tenantId_ordenId_idx"
  ON "OrdenTrabajoPasoDependencia"("tenantId", "ordenId");
CREATE INDEX "OrdenTrabajoPasoDependencia_tenantId_predecesorPasoId_idx"
  ON "OrdenTrabajoPasoDependencia"("tenantId", "predecesorPasoId");
CREATE INDEX "OrdenTrabajoPasoDependencia_tenantId_sucesorPasoId_idx"
  ON "OrdenTrabajoPasoDependencia"("tenantId", "sucesorPasoId");

ALTER TABLE "OrdenTrabajoPasoDependencia"
  ADD CONSTRAINT "OrdenTrabajoPasoDependencia_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrdenTrabajoPasoDependencia"
  ADD CONSTRAINT "OrdenTrabajoPasoDependencia_ordenId_fkey"
  FOREIGN KEY ("ordenId") REFERENCES "OrdenTrabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrdenTrabajoPasoDependencia"
  ADD CONSTRAINT "OrdenTrabajoPasoDependencia_predecesorPasoId_fkey"
  FOREIGN KEY ("predecesorPasoId") REFERENCES "OrdenTrabajoItemPaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrdenTrabajoPasoDependencia"
  ADD CONSTRAINT "OrdenTrabajoPasoDependencia_sucesorPasoId_fkey"
  FOREIGN KEY ("sucesorPasoId") REFERENCES "OrdenTrabajoItemPaso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
