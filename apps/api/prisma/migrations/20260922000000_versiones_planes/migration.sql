CREATE TABLE "PlanVersion" (
  "id" UUID NOT NULL,
  "borradorId" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "numero" INTEGER NOT NULL CHECK ("numero" > 0),
  "revisionBorrador" INTEGER NOT NULL CHECK ("revisionBorrador" > 0),
  "catalogoVersion" INTEGER NOT NULL,
  "contenido" JSONB NOT NULL,
  "catalogoSnapshot" JSONB NOT NULL,
  "publicadoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publicadoPorId" UUID NOT NULL,
  "publicadoPorNombre" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanVersion_borradorId_fkey" FOREIGN KEY ("borradorId") REFERENCES "PlanBorrador"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlanVersion_borradorId_numero_key" ON "PlanVersion"("borradorId", "numero");
CREATE UNIQUE INDEX "PlanVersion_borradorId_revisionBorrador_key" ON "PlanVersion"("borradorId", "revisionBorrador");

CREATE FUNCTION proteger_version_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Las versiones publicadas de planes son inmutables';
END;
$$;
CREATE TRIGGER "PlanVersion_inmutable"
BEFORE UPDATE OR DELETE ON "PlanVersion"
FOR EACH ROW EXECUTE FUNCTION proteger_version_plan();
