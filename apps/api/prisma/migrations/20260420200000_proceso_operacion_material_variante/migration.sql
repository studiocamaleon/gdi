-- SM.1.d — Marca un material como SUSTRATO del nesting del paso.
-- Cuando es true, el motor itera las variantes habilitadas (ver
-- `ProcesoOperacionMaterialVariante`) en lugar de usar `materiaPrimaVarianteId`,
-- corre el algoritmo (ej. nesting-rollo) por cada variante y elige la mejor
-- por `configNestingV2.criterioSeleccionMaterial`.
ALTER TABLE "ProcesoOperacionMaterial"
  ADD COLUMN "esSustratoNesting" BOOLEAN NOT NULL DEFAULT false;

-- SM.1.d — Tabla puente: variantes habilitadas de la materia prima sustrato
-- para un paso específico. Permite que el producto declare un subset de
-- variantes (anchos de rollo, gramajes, etc.) que el motor evalúa al
-- correr el algoritmo de nesting.
CREATE TABLE "ProcesoOperacionMaterialVariante" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "procesoOperacionMaterialId" UUID NOT NULL,
  "materiaPrimaVarianteId" UUID NOT NULL,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProcesoOperacionMaterialVariante_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcesoOperacionMaterialVariante_tenantId_pomId_activo_orden_idx"
  ON "ProcesoOperacionMaterialVariante"("tenantId", "procesoOperacionMaterialId", "activo", "orden");

CREATE INDEX "ProcesoOperacionMaterialVariante_tenantId_materiaPrimaVar_idx"
  ON "ProcesoOperacionMaterialVariante"("tenantId", "materiaPrimaVarianteId");

CREATE UNIQUE INDEX "ProcesoOperacionMaterialVariante_pomId_varianteId_key"
  ON "ProcesoOperacionMaterialVariante"("procesoOperacionMaterialId", "materiaPrimaVarianteId");

ALTER TABLE "ProcesoOperacionMaterialVariante"
  ADD CONSTRAINT "ProcesoOperacionMaterialVariante_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacionMaterialVariante"
  ADD CONSTRAINT "ProcesoOperacionMaterialVariante_pomId_fkey"
  FOREIGN KEY ("procesoOperacionMaterialId") REFERENCES "ProcesoOperacionMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcesoOperacionMaterialVariante"
  ADD CONSTRAINT "ProcesoOperacionMaterialVariante_materiaPrimaVarianteId_fkey"
  FOREIGN KEY ("materiaPrimaVarianteId") REFERENCES "MateriaPrimaVariante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
