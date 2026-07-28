-- Costo por click: el desgaste de la máquina (drum, fusor, cuchillas) se
-- prorratea por cantidad de páginas, no por cobertura como el tóner.
-- Ver docs/costo-por-click-desgaste-diseno.md
--
-- Dos cambios para que la pieza se pueda cargar y costear:
--
-- 1. El repuesto deja de exigir una variante de inventario. Cargar un drum
--    obligaba a darlo de alta antes como materia prima; ahora alcanza con su
--    precio, y el vínculo con inventario queda para cuando se quiera seguir
--    el stock. Si hay variante, su precio de referencia sigue mandando.
ALTER TABLE "MaquinaComponenteDesgaste"
  ALTER COLUMN "materiaPrimaVarianteId" DROP NOT NULL;

ALTER TABLE "MaquinaComponenteDesgaste"
  ADD COLUMN "precioUnitario" DECIMAL(14,2);

-- 2. En una máquina color, un trabajo en blanco y negro mueve sólo el drum
--    negro: sin esta marca, cobraría también los CMY que no giraron.
ALTER TABLE "MaquinaComponenteDesgaste"
  ADD COLUMN "soloColor" BOOLEAN NOT NULL DEFAULT false;
