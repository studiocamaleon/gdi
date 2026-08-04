-- Elimina las plantillas SOLDADORA y CABINA_PINTURA del enum PlantillaMaquinaria.
-- Postgres no soporta DROP VALUE en un enum: se recrea el tipo sin esos valores.
-- Seguro: ninguna Maquina usa esas plantillas (verificado antes de la migración).
ALTER TYPE "PlantillaMaquinaria" RENAME TO "PlantillaMaquinaria_old";
CREATE TYPE "PlantillaMaquinaria" AS ENUM (
  'IMPRESORA_LASER',
  'IMPRESORA_GRAN_FORMATO_POR_AREA',
  'GUILLOTINA',
  'PLOTTER_DE_CORTE',
  'PLOTTER_CAD',
  'LAMINADORA_BOPP_ROLLO',
  'CORTE_LASER',
  'ROUTER_CNC',
  'ANILLADORA',
  'MESA_DE_CORTE',
  'PLANCHA_TERMICA'
);
ALTER TABLE "Maquina"
  ALTER COLUMN "plantilla" TYPE "PlantillaMaquinaria"
  USING ("plantilla"::text::"PlantillaMaquinaria");
DROP TYPE "PlantillaMaquinaria_old";
