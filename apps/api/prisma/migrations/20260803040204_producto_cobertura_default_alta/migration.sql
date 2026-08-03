-- Cobertura de tóner por defecto del catálogo: los productos existentes pasan a
-- 'alta' (decisión de negocio). Cost-neutral: tras el backfill de Fase 1 las 3
-- columnas de consumo son iguales, así que el nivel no cambia el costo hasta que
-- el taller las diferencie. Ver docs/cobertura-toner-por-nivel-diseno.md.
UPDATE "Producto" SET "coberturaDefault" = 'alta' WHERE "coberturaDefault" IS NULL;
