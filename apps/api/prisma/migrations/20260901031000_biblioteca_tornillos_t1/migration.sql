INSERT INTO "MaterialPreset" (
  "id", "key", "nombreCanonico", "descripcionCorta", "familia",
  "subfamilia", "tipoTecnico", "templateId", "iconKind",
  "aliasDisponiblesJson", "usosRecomendadosJson", "procesosCompatiblesJson",
  "advertenciasJson", "activo", "orden", "createdAt", "updatedAt"
)
VALUES (
  'cc71748e-4804-4147-b6ea-a59dd85ec091',
  'TORNILLO_AUTOPERFORANTE_T1',
  'Tornillo autoperforante T1',
  'Tornillo T1 punta mecha para cartelería, bastidores, chapas y estructuras metálicas livianas.',
  'MAGNETICO_FIJACION',
  'FIJACION_AUXILIAR',
  'tornillo_autoperforante',
  'fijacion_auxiliar_v1',
  'objeto',
  '["Tornillo T1", "T1 punta mecha", "Autoperforante T1", "Tornillo cabeza tanque", "Tornillo cabeza flangeada", "Tornillo para bastidor"]'::jsonb,
  '["carteleria", "cajas_luz", "estructuras_metalicas", "pop_signage"]'::jsonb,
  '["fabricacion_bastidor", "ensamble_estructural", "montaje_carteleria"]'::jsonb,
  '["La cantidad por caja varía según fabricante y proveedor. Confirmar la presentación comercial al asociar la variante a un proveedor."]'::jsonb,
  true,
  901,
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
  'Zincado',
  true,
  jsonb_build_object(
    'tipoFijacion', 'Tornillo autoperforante',
    'linea', 'T1',
    'tipoPunta', 'Mecha',
    'tipoCabeza', 'Tanque / flangeada',
    'encastre', 'Phillips #2',
    'material', 'Acero zincado',
    'calibre', variantes.calibre,
    'largo', variantes.largo_mm,
    'largoMm', variantes.largo_mm,
    'largoPulgadas', variantes.largo_pulgadas,
    'medidaNominal', variantes.formato,
    'unidadesPorCaja', variantes.unidades_por_caja,
    'presentacionReferencia', true
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
    ('d620da13-6a47-4355-97a8-2d04fa0e9531', 'T1-PM-8X1D2-X10000', 'T1 #8 × 1/2" · caja de referencia x 10000', '#8 × 1/2"', 8, 12.7, '1/2', 10000, 0),
    ('1f56fb14-9e84-4f14-8eef-e16d2bb0b5a5', 'T1-PM-8X3D4-X5000', 'T1 #8 × 3/4" · caja de referencia x 5000', '#8 × 3/4"', 8, 19.05, '3/4', 5000, 1),
    ('3da008e1-4919-476c-b5ec-4906f0d6169e', 'T1-PM-10X1-X2500', 'T1 #10 × 1" · caja de referencia x 2500', '#10 × 1"', 10, 25.4, '1', 2500, 2),
    ('49e8426d-cd8f-4b38-a4f6-2ce48a9af252', 'T1-PM-10X1-1D2-X2000', 'T1 #10 × 1 1/2" · caja de referencia x 2000', '#10 × 1 1/2"', 10, 38.1, '1 1/2', 2000, 3)
) AS variantes(id, sku, nombre, formato, calibre, largo_mm, largo_pulgadas, unidades_por_caja, orden)
WHERE preset."key" = 'TORNILLO_AUTOPERFORANTE_T1'
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
