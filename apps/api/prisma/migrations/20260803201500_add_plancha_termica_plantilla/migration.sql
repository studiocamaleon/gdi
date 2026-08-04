-- Nueva plantilla de maquinaria: PLANCHA_TERMICA (aplicación de transfer textil).
-- Aditivo: no se usa el valor en esta misma transacción, así que ADD VALUE es seguro.
ALTER TYPE "PlantillaMaquinaria" ADD VALUE IF NOT EXISTS 'PLANCHA_TERMICA';
