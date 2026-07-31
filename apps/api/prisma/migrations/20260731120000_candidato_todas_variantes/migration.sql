-- Modo "todas las variantes" por candidato de material.
--
-- Un candidato con todasLasVariantes=true usa TODAS las variantes activas de
-- su materia prima (resueltas en vivo por el loader), en vez de la lista fija.
-- Así una variante nueva del material se absorbe sola en los productos que la
-- ofrecen entera, sin re-guardar producto por producto.
--
-- Default false: los productos existentes conservan su lista fija — cero
-- cambio de comportamiento.
ALTER TABLE "ProductoConfigPasoSlotMaterialCandidato"
  ADD COLUMN "todasLasVariantes" BOOLEAN NOT NULL DEFAULT false;
