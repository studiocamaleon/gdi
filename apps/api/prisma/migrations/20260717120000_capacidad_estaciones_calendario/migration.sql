-- Capacidad de estaciones en TIEMPO (docs/capacidad-estaciones-diseno.md).
-- D3: muere el horario texto libre (era informativo, sin dato que preservar);
-- D2: entra el calendario semanal estructurado por estación.
ALTER TABLE "Estacion" DROP COLUMN "horario";
ALTER TABLE "Estacion" ADD COLUMN "calendarioJson" JSONB;
