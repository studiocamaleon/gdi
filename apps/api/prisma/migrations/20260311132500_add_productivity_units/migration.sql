-- Add productivity units used by machinery templates
ALTER TYPE "UnidadProduccionMaquina" ADD VALUE IF NOT EXISTS 'PPM';
ALTER TYPE "UnidadProduccionMaquina" ADD VALUE IF NOT EXISTS 'M2_H';
ALTER TYPE "UnidadProduccionMaquina" ADD VALUE IF NOT EXISTS 'PIEZAS_H';
