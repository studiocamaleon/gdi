-- P3.a.1 — Extensiones modelo universal en ProcesoOperacionPlantilla.
-- La biblioteca de pasos (plantillas reutilizables) ahora declara los mismos
-- campos V2 que ProcesoOperacion, para que al instanciar un paso desde una
-- plantilla se arrastre toda la info del modelo universal (familia, nesting,
-- activación, condición) en vez de quedar sólo con los campos v1.

ALTER TABLE "ProcesoOperacionPlantilla"
  ADD COLUMN "familiaV2"           TEXT,
  ADD COLUMN "unidadProductivaV2"  TEXT,
  ADD COLUMN "activacionV2"        "ActivacionPasoV2",
  ADD COLUMN "condicionV2"         JSONB,
  ADD COLUMN "leeDelTrabajoV2"     JSONB,
  ADD COLUMN "leeDePasosV2"        JSONB,
  ADD COLUMN "produceV2"           JSONB,
  ADD COLUMN "configNestingV2"     JSONB;

CREATE INDEX "ProcesoOperacionPlantilla_tenantId_familiaV2_idx"
  ON "ProcesoOperacionPlantilla"("tenantId", "familiaV2")
  WHERE "familiaV2" IS NOT NULL;
