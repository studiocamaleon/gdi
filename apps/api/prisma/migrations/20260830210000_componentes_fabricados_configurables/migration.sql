ALTER TABLE "ProductoRecetaComponente"
ADD COLUMN "configuracionJson" JSONB;

ALTER TABLE "OrdenTrabajoItem"
ADD COLUMN "jobContextSnapshotJson" JSONB;
