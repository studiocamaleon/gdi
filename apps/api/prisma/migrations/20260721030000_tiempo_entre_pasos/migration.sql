-- Tiempo de preparación entre pasos.
-- El plan de producción encadenaba un paso con el siguiente sin un minuto de
-- aire: nadie termina 9:35 y arranca otro paso 9:35. Ese tiempo lo hace el
-- operario (ocupa un puesto), pero no la máquina.

-- Por estación. NULL = hereda el default del tenant.
ALTER TABLE "Estacion" ADD COLUMN "tiempoPreparacionMin" INTEGER;

-- Default del tenant para las estaciones que no declaran el suyo.
ALTER TABLE "ConfiguracionProduccion"
  ADD COLUMN "tiempoEntrePasosMin" INTEGER NOT NULL DEFAULT 0;
