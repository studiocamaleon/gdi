-- Plantillas de maquinaria de terminación
ALTER TYPE "PlantillaMaquinaria" ADD VALUE IF NOT EXISTS 'GUILLOTINA';
ALTER TYPE "PlantillaMaquinaria" ADD VALUE IF NOT EXISTS 'LAMINADORA_BOPP_ROLLO';
ALTER TYPE "PlantillaMaquinaria" ADD VALUE IF NOT EXISTS 'REDONDEADORA_PUNTAS';
ALTER TYPE "PlantillaMaquinaria" ADD VALUE IF NOT EXISTS 'PERFORADORA';

-- Unidades de producción para perfiles de terminación
ALTER TYPE "UnidadProduccionMaquina" ADD VALUE IF NOT EXISTS 'CORTES_MIN';
ALTER TYPE "UnidadProduccionMaquina" ADD VALUE IF NOT EXISTS 'GOLPES_MIN';
ALTER TYPE "UnidadProduccionMaquina" ADD VALUE IF NOT EXISTS 'PLIEGOS_MIN';
ALTER TYPE "UnidadProduccionMaquina" ADD VALUE IF NOT EXISTS 'M_MIN';
