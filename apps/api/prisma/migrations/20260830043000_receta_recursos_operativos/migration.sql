ALTER TABLE "ProductoRecetaRecurso"
  ADD COLUMN "estacionId" UUID,
  ADD COLUMN "estacionNombre" VARCHAR(180),
  ADD COLUMN "capacidadesSnapshotJson" JSONB,
  ADD COLUMN "habilidadesRequeridas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
