-- Re-etiquetar pasos/plantillas a FIJA (productividad numérica).
--
-- El mapeo viejo del DTO enviaba "variable" → enum FORMULA. Por eso muchas
-- plantillas existentes tienen `modoProductividad = FORMULA` aunque
-- conceptualmente eran "Productividad variable" (valor numérico + unidad
-- compuesta), no fórmula evaluable.
--
-- Patrón a re-etiquetar:
--   modoProductividad = FORMULA
--   productividadBase IS NOT NULL  (tiene valor numérico)
--   reglaVelocidadJson IS NULL     (NO tiene fórmula real)
--
-- Después de este UPDATE, FORMULA queda solo para los pasos que sí declaran
-- una `reglaVelocidadJson` válida (modo avanzado postergado).

UPDATE "ProcesoOperacionPlantilla"
SET "modoProductividad" = 'FIJA'
WHERE "modoProductividad" = 'FORMULA'
  AND "productividadBase" IS NOT NULL
  AND "reglaVelocidadJson" IS NULL;

UPDATE "ProcesoOperacion"
SET "modoProductividad" = 'FIJA'
WHERE "modoProductividad" = 'FORMULA'
  AND "productividadBase" IS NOT NULL
  AND "reglaVelocidadJson" IS NULL;
