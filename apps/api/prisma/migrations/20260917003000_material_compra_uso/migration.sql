ALTER TABLE "MateriaPrimaVariante"
  ADD COLUMN "unidadPrecio" "UnidadMateriaPrima",
  ADD COLUMN "equivalenciaCompra" DECIMAL(20,8);

ALTER TABLE "MateriaPrimaVariante" ADD CONSTRAINT "MateriaPrimaVariante_equivalencia_positiva"
  CHECK ("equivalenciaCompra" IS NULL OR "equivalenciaCompra" > 0);

-- No se cambia ningún importe. Solo se identifica una unidad cuando es inequívoca.
-- Los casos compra != uso requieren confirmar la unidad del precio en la ficha.
UPDATE "MateriaPrimaVariante" v
SET "unidadPrecio" = COALESCE(v."unidadStock", m."unidadStock")
FROM "MateriaPrima" m
WHERE m.id = v."materiaPrimaId"
  AND COALESCE(v."unidadStock", m."unidadStock") = COALESCE(v."unidadCompra", m."unidadCompra");
