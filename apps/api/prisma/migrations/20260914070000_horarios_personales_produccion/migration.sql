ALTER TABLE "Empleado" ADD COLUMN "calendarioProduccionJson" JSONB;
ALTER TABLE "Estacion" ADD COLUMN "planificacionPorEmpleados" BOOLEAN NOT NULL DEFAULT false;
