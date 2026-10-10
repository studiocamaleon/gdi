ALTER TABLE "EstacionEmpleado" ADD COLUMN "asignacionAutomatica" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "OrdenTrabajoItem" ADD COLUMN "personalPrevistoJson" JSONB;
