-- Nueva plantilla de maquinaria: IMPRESORA_3D (FDM / resina).
-- Nueva unidad de producción: G_H (gramos por hora), el caudal de material
-- depositado con el que se cotiza el tiempo de impresión 3D.
-- Aditivo: los valores no se usan en esta misma transacción, así que
-- ADD VALUE es seguro.
ALTER TYPE "PlantillaMaquinaria" ADD VALUE IF NOT EXISTS 'IMPRESORA_3D';
ALTER TYPE "UnidadProduccionMaquina" ADD VALUE IF NOT EXISTS 'G_H';
