-- Nombre alternativo de hoja para materiales rígidos; no modifica datos existentes.
ALTER TYPE "UnidadMateriaPrima" ADD VALUE IF NOT EXISTS 'PLACA';
