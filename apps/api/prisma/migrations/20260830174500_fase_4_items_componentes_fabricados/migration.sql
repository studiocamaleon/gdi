-- Los componentes fabricados se ejecutan como items hijos dentro de la OT.
ALTER TABLE "OrdenTrabajoItem"
  ADD COLUMN "parentItemId" UUID,
  ADD COLUMN "componenteCodigo" VARCHAR(100),
  ADD COLUMN "nodoIncorporacionClave" VARCHAR(160);

CREATE UNIQUE INDEX "OrdenTrabajoItem_parentItemId_componenteCodigo_key"
  ON "OrdenTrabajoItem"("parentItemId", "componenteCodigo");
CREATE INDEX "OrdenTrabajoItem_tenantId_parentItemId_idx"
  ON "OrdenTrabajoItem"("tenantId", "parentItemId");

ALTER TABLE "OrdenTrabajoItem"
  ADD CONSTRAINT "OrdenTrabajoItem_parentItemId_fkey"
  FOREIGN KEY ("parentItemId") REFERENCES "OrdenTrabajoItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
