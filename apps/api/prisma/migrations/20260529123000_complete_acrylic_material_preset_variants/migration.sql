-- Completa la biblioteca canónica de acrílicos con espesores 2, 3, 4, 5, 6, 8 y 10 mm
-- para cada variante de color existente: Cristal, Opal y Negro.

WITH preset AS (
  SELECT id
  FROM "MaterialPreset"
  WHERE key = 'ACRILICO'
),
desired(
  "skuSugerido",
  "formato",
  "ancho",
  "alto",
  "espesor",
  "color",
  "recomendada",
  "orden"
) AS (
  VALUES
    ('ACR-CR-2', '2050 × 3050 mm', 2.05, 3.05, 2, 'Cristal', false, 0),
    ('ACR-CR-3', '2050 × 3050 mm', 2.05, 3.05, 3, 'Cristal', true, 1),
    ('ACR-CR-4', '2050 × 3050 mm', 2.05, 3.05, 4, 'Cristal', false, 2),
    ('ACR-CR-5', '2050 × 3050 mm', 2.05, 3.05, 5, 'Cristal', true, 3),
    ('ACR-CR-6', '2050 × 3050 mm', 2.05, 3.05, 6, 'Cristal', false, 4),
    ('ACR-CR-8', '2050 × 3050 mm', 2.05, 3.05, 8, 'Cristal', false, 5),
    ('ACR-CR-10', '2050 × 3050 mm', 2.05, 3.05, 10, 'Cristal', false, 6),
    ('ACR-OP-2', '2050 × 3050 mm', 2.05, 3.05, 2, 'Opal', false, 10),
    ('ACR-OP-3', '2050 × 3050 mm', 2.05, 3.05, 3, 'Opal', true, 11),
    ('ACR-OP-4', '2050 × 3050 mm', 2.05, 3.05, 4, 'Opal', false, 12),
    ('ACR-OP-5', '2050 × 3050 mm', 2.05, 3.05, 5, 'Opal', true, 13),
    ('ACR-OP-6', '2050 × 3050 mm', 2.05, 3.05, 6, 'Opal', false, 14),
    ('ACR-OP-8', '2050 × 3050 mm', 2.05, 3.05, 8, 'Opal', false, 15),
    ('ACR-OP-10', '2050 × 3050 mm', 2.05, 3.05, 10, 'Opal', false, 16),
    ('ACR-NG-2', '2050 × 3050 mm', 2.05, 3.05, 2, 'Negro', false, 20),
    ('ACR-NG-3', '2050 × 3050 mm', 2.05, 3.05, 3, 'Negro', false, 21),
    ('ACR-NG-4', '2050 × 3050 mm', 2.05, 3.05, 4, 'Negro', false, 22),
    ('ACR-NG-5', '2050 × 3050 mm', 2.05, 3.05, 5, 'Negro', false, 23),
    ('ACR-NG-6', '2050 × 3050 mm', 2.05, 3.05, 6, 'Negro', false, 24),
    ('ACR-NG-8', '2050 × 3050 mm', 2.05, 3.05, 8, 'Negro', false, 25),
    ('ACR-NG-10', '2050 × 3050 mm', 2.05, 3.05, 10, 'Negro', false, 26)
)
INSERT INTO "MaterialPresetVariante" (
  "presetId",
  "skuSugerido",
  "nombreVarianteSugerido",
  "formato",
  "espesor",
  "color",
  "recomendada",
  "atributosVarianteJson",
  "unidadStock",
  "unidadCompra",
  "precioReferencia",
  "moneda",
  "orden",
  "activo",
  "createdAt",
  "updatedAt"
)
SELECT
  preset.id,
  desired."skuSugerido",
  desired."formato" || ' · ' || desired."espesor"::text || ' mm · ' || desired."color",
  desired."formato",
  desired."espesor",
  desired."color",
  desired."recomendada",
  jsonb_build_object(
    'ancho', desired."ancho",
    'alto', desired."alto",
    'espesor', desired."espesor",
    'colorBase', desired."color"
  ),
  'UNIDAD'::"UnidadMateriaPrima",
  'UNIDAD'::"UnidadMateriaPrima",
  NULL,
  'ARS',
  desired."orden",
  true,
  now(),
  now()
FROM preset
CROSS JOIN desired
ON CONFLICT ("presetId", "skuSugerido") DO UPDATE
SET
  "nombreVarianteSugerido" = EXCLUDED."nombreVarianteSugerido",
  "formato" = EXCLUDED."formato",
  "espesor" = EXCLUDED."espesor",
  "color" = EXCLUDED."color",
  "recomendada" = EXCLUDED."recomendada",
  "atributosVarianteJson" = EXCLUDED."atributosVarianteJson",
  "unidadStock" = EXCLUDED."unidadStock",
  "unidadCompra" = EXCLUDED."unidadCompra",
  "moneda" = EXCLUDED."moneda",
  "orden" = EXCLUDED."orden",
  "activo" = true,
  "updatedAt" = now();
