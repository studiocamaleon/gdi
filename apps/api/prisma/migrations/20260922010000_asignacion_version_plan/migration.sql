ALTER TABLE "Suscripcion" ADD COLUMN "planVersionId" UUID, ADD COLUMN "revisionContrato" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Suscripcion_planVersionId_idx" ON "Suscripcion"("planVersionId");
