-- DROP de la columna redundante `estrategiaCosto` del slot. El costeo del
-- sustrato lo posee el nesting (fuente única `nestingConfig.costing`); esta
-- columna ya no la lee el motor ni la escriben los editores, y el backfill
-- previo (20260814120000) preservó su valor donde hacía falta. Corre DESPUÉS
-- del backfill. Ver docs/editor-pasos-preguntas-orden.md §10.5.
ALTER TABLE "ProductoConfigPasoSlotMaterial" DROP COLUMN "estrategiaCosto";
