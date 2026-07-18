-- Categorías adicionales de gasto fijo (alinean con el diseño de la vista).
-- Aditivo: no se usan en esta transacción, así que ADD VALUE es seguro.
ALTER TYPE "CategoriaGastoFijo" ADD VALUE IF NOT EXISTS 'SEGUROS';
ALTER TYPE "CategoriaGastoFijo" ADD VALUE IF NOT EXISTS 'SOFTWARE';
ALTER TYPE "CategoriaGastoFijo" ADD VALUE IF NOT EXISTS 'LEGAL';
