-- F4.4.2: una tanda consolidada de nesting se ejecuta una sola vez en la OT.
ALTER TABLE "OrdenTrabajoItemPaso"
  ADD COLUMN "nestingLoteId" VARCHAR(100),
  ADD COLUMN "nestingLoteRol" VARCHAR(20),
  ADD COLUMN "nestingLoteSnapshotJson" JSONB;

CREATE INDEX "OrdenTrabajoItemPaso_tenantId_ordenId_nestingLoteId_idx"
  ON "OrdenTrabajoItemPaso"("tenantId", "ordenId", "nestingLoteId");
