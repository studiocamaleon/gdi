INSERT INTO "MaterialPreset" (
  "id", "key", "nombreCanonico", "descripcionCorta", "familia",
  "subfamilia", "tipoTecnico", "templateId", "iconKind",
  "aliasDisponiblesJson", "usosRecomendadosJson", "procesosCompatiblesJson",
  "advertenciasJson", "activo", "orden", "createdAt", "updatedAt"
)
VALUES (
  '0d7d0999-1e18-4ead-8d82-3c8db34a39a1',
  'OJAL_NIQUELADO',
  'Ojales niquelados',
  'Ojales metálicos con terminación níquel para lona, banners, carteles y otras piezas perforables.',
  'HERRAJE_ACCESORIO',
  'OJAL_OJALILLO_REMACHE',
  'ojal',
  'ojal_ojalillo_remache_v1',
  'objeto',
  '["Ojal niquelado", "Ojal de níquel", "Ojalillo niquelado", "Ojal metálico"]'::jsonb,
  '["banners", "carteleria", "lonas", "inmobiliaria"]'::jsonb,
  '["colocacion_ojales"]'::jsonb,
  '["Confirmar que el diámetro indicado corresponda al diámetro interno del ojal."]'::jsonb,
  true,
  900,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE SET
  "nombreCanonico" = EXCLUDED."nombreCanonico",
  "descripcionCorta" = EXCLUDED."descripcionCorta",
  "familia" = EXCLUDED."familia",
  "subfamilia" = EXCLUDED."subfamilia",
  "tipoTecnico" = EXCLUDED."tipoTecnico",
  "templateId" = EXCLUDED."templateId",
  "iconKind" = EXCLUDED."iconKind",
  "aliasDisponiblesJson" = EXCLUDED."aliasDisponiblesJson",
  "usosRecomendadosJson" = EXCLUDED."usosRecomendadosJson",
  "procesosCompatiblesJson" = EXCLUDED."procesosCompatiblesJson",
  "advertenciasJson" = EXCLUDED."advertenciasJson",
  "activo" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "MaterialPresetVariante" (
  "id", "presetId", "skuSugerido", "nombreVarianteSugerido", "formato",
  "espesor", "color", "recomendada", "atributosVarianteJson",
  "unidadStock", "unidadCompra", "precioReferencia", "moneda", "orden",
  "activo", "createdAt", "updatedAt"
)
SELECT
  variantes.id::uuid,
  preset.id,
  variantes.sku,
  variantes.nombre,
  variantes.formato,
  NULL,
  'Níquel',
  variantes.recomendada,
  jsonb_build_object(
    'diametroInterno', variantes.diametro,
    'material', 'Metal',
    'terminacion', 'Niquelado'
  ),
  'UNIDAD',
  'CAJA',
  NULL,
  'ARS',
  variantes.orden,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "MaterialPreset" AS preset
CROSS JOIN (
  VALUES
    ('70eddb32-6865-4098-a34a-b40a79985108', 'OJAL-NIQ-8MM', 'Ojal niquelado Ø 8 mm', 'Ø interno 8 mm', 8, false, 0),
    ('e6393214-d90e-4e1f-84f5-95fa976f9303', 'OJAL-NIQ-10MM', 'Ojal niquelado Ø 10 mm', 'Ø interno 10 mm', 10, true, 1),
    ('7abfa706-638e-47b7-8f0e-3737f6adf1b6', 'OJAL-NIQ-13MM', 'Ojal niquelado Ø 13 mm', 'Ø interno 13 mm', 13, false, 2)
) AS variantes(id, sku, nombre, formato, diametro, recomendada, orden)
WHERE preset."key" = 'OJAL_NIQUELADO'
ON CONFLICT ("presetId", "skuSugerido") DO UPDATE SET
  "nombreVarianteSugerido" = EXCLUDED."nombreVarianteSugerido",
  "formato" = EXCLUDED."formato",
  "color" = EXCLUDED."color",
  "recomendada" = EXCLUDED."recomendada",
  "atributosVarianteJson" = EXCLUDED."atributosVarianteJson",
  "unidadStock" = EXCLUDED."unidadStock",
  "unidadCompra" = EXCLUDED."unidadCompra",
  "moneda" = EXCLUDED."moneda",
  "orden" = EXCLUDED."orden",
  "activo" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
