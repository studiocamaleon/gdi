-- Re-etiquetado adicional: pasos con `modoProductividad = FORMULA` cuyo
-- `reglaVelocidadJson` NO es una fórmula válida.
--
-- La migration anterior (20260422140000) usó `reglaVelocidadJson IS NULL`,
-- pero PostgreSQL distingue entre SQL NULL y JSON null literal. Algunos
-- registros tenían `reglaVelocidadJson = 'null'::jsonb` o un objeto vacío,
-- que no son fórmulas reales pero tampoco son SQL NULL.
--
-- Este UPDATE captura todos los casos donde el JSON no es una fórmula
-- válida (esquema esperado: { tipo: 'formula_v1' | 'tabla_v1', ... }).

UPDATE "ProcesoOperacionPlantilla"
SET "modoProductividad" = 'FIJA'
WHERE "modoProductividad" = 'FORMULA'
  AND "productividadBase" IS NOT NULL
  AND (
    "reglaVelocidadJson" IS NULL
    OR "reglaVelocidadJson" = 'null'::jsonb
    OR jsonb_typeof("reglaVelocidadJson") <> 'object'
    OR NOT ("reglaVelocidadJson" ? 'tipo')
  );

UPDATE "ProcesoOperacion"
SET "modoProductividad" = 'FIJA'
WHERE "modoProductividad" = 'FORMULA'
  AND "productividadBase" IS NOT NULL
  AND (
    "reglaVelocidadJson" IS NULL
    OR "reglaVelocidadJson" = 'null'::jsonb
    OR jsonb_typeof("reglaVelocidadJson") <> 'object'
    OR NOT ("reglaVelocidadJson" ? 'tipo')
  );
