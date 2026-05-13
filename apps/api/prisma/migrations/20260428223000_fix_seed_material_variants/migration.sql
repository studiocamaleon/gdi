-- Align seed materials with the current frontend template catalog and complete
-- the variant attributes that the Variantes tab renders as columns.

UPDATE "MateriaPrima"
SET "templateId" = 'sustrato_hoja_v1', "updatedAt" = now()
WHERE "codigo" IN ('PAPEL-OPALINA-300', 'PAPEL-AUTOCOP-CB', 'PAPEL-AUTOCOP-CFB');

UPDATE "MateriaPrima"
SET "templateId" = 'sustrato_rollo_flexible_v1', "updatedAt" = now()
WHERE "codigo" = 'VINILO-BLANCO-MONO';

UPDATE "MateriaPrima"
SET "templateId" = 'sustrato_rigido_v1', "updatedAt" = now()
WHERE "codigo" = 'MDF-9MM';

UPDATE "MateriaPrima"
SET "templateId" = 'laminado_film_v1', "updatedAt" = now()
WHERE "codigo" IN ('FILM-BOPP-MATE', 'FILM-BOPP-BRILLO');

UPDATE "MateriaPrima"
SET "templateId" = 'embalaje_proteccion_v1', "updatedAt" = now()
WHERE "codigo" = 'BOLSA-CELOFAN-100';

UPDATE "MateriaPrima"
SET "templateId" = 'toner_v1', "updatedAt" = now()
WHERE "codigo" = 'TONER-CMYK-RICOH';

UPDATE "MateriaPrima"
SET "templateId" = 'tinta_impresion_v1', "updatedAt" = now()
WHERE "codigo" IN ('TINTA-LATEX-ROLAND', 'TINTA-UV-MIMAKI');

UPDATE "MateriaPrima"
SET "atributosTecnicosJson" = "atributosTecnicosJson" || jsonb_build_object('colores', 'CMYK'), "updatedAt" = now()
WHERE "codigo" = 'TINTA-LATEX-ROLAND';

UPDATE "MateriaPrimaVariante"
SET
  "atributosVarianteJson" = jsonb_build_object(
    'formatoComercial', '65 x 45 cm',
    'ancho', 65,
    'alto', 45,
    'gramaje', 300,
    'material', 'Opalina',
    'color', 'Blanco',
    'acabado', 'Mate',
    'anchoMm', 650,
    'altoMm', 450,
    'largoMm', 450,
    'gramajeGr', 300
  ),
  "updatedAt" = now()
WHERE "sku" = 'OPALINA-300-65X45';

UPDATE "MateriaPrimaVariante"
SET
  "atributosVarianteJson" = jsonb_build_object(
    'formatoComercial', '22 x 34 cm',
    'ancho', 22,
    'alto', 34,
    'gramaje', 56,
    'material', 'Autocopiativo CB',
    'color', 'Blanco',
    'acabado', 'Mate',
    'anchoMm', 220,
    'altoMm', 340,
    'largoMm', 340,
    'gramajeGr', 56
  ),
  "updatedAt" = now()
WHERE "sku" = 'AUTOCOP-CB-22X34';

UPDATE "MateriaPrimaVariante"
SET
  "atributosVarianteJson" = jsonb_build_object(
    'formatoComercial', '22 x 34 cm',
    'ancho', 22,
    'alto', 34,
    'gramaje', 56,
    'material', 'Autocopiativo CFB',
    'color', 'Rosa',
    'acabado', 'Mate',
    'anchoMm', 220,
    'altoMm', 340,
    'largoMm', 340,
    'gramajeGr', 56
  ),
  "updatedAt" = now()
WHERE "sku" = 'AUTOCOP-CFB-22X34';

UPDATE "MateriaPrimaVariante"
SET
  "atributosVarianteJson" = jsonb_build_object(
    'ancho', 1.37,
    'largo', 50,
    'acabado', 'Brillante',
    'anchoMm', 1370,
    'largoMm', 50000,
    'largoRolloMm', 50000
  ),
  "updatedAt" = now()
WHERE "sku" = 'VINILO-BLANCO-1370';

UPDATE "MateriaPrimaVariante"
SET
  "atributosVarianteJson" = jsonb_build_object(
    'ancho', 1.52,
    'largo', 50,
    'acabado', 'Brillante',
    'anchoMm', 1520,
    'largoMm', 50000,
    'largoRolloMm', 50000
  ),
  "updatedAt" = now()
WHERE "sku" = 'VINILO-BLANCO-1520';

UPDATE "MateriaPrimaVariante"
SET
  "atributosVarianteJson" = jsonb_build_object(
    'ancho', 1.83,
    'alto', 2.75,
    'espesor', 9,
    'colorBase', 'Natural',
    'anchoMm', 1830,
    'altoMm', 2750,
    'largoMm', 2750,
    'espesorMm', 9
  ),
  "updatedAt" = now()
WHERE "sku" = 'MDF-9MM-183X275';

UPDATE "MateriaPrimaVariante"
SET
  "atributosVarianteJson" = jsonb_build_object(
    'ancho', 650,
    'largo', 1000,
    'acabado', 'Mate',
    'espesor', 0.027,
    'anchoMm', 650,
    'largoMm', 1000000,
    'largoRolloMm', 1000000
  ),
  "updatedAt" = now()
WHERE "sku" = 'BOPP-MATE-650';

UPDATE "MateriaPrimaVariante"
SET
  "atributosVarianteJson" = jsonb_build_object(
    'ancho', 650,
    'largo', 1000,
    'acabado', 'Brillo',
    'espesor', 0.027,
    'anchoMm', 650,
    'largoMm', 1000000,
    'largoRolloMm', 1000000
  ),
  "updatedAt" = now()
WHERE "sku" = 'BOPP-BRILLO-650';

UPDATE "MateriaPrimaVariante"
SET
  "atributosVarianteJson" = jsonb_build_object(
    'tipoEmbalaje', 'Bolsa',
    'capacidadUnidades', 100,
    'ancho', 9,
    'alto', 6,
    'material', 'Celofan',
    'anchoMm', 90,
    'altoMm', 60,
    'largoMm', 60,
    'piezasPorCaja', 100
  ),
  "updatedAt" = now()
WHERE "sku" = 'BOLSA-100';

UPDATE "MateriaPrimaVariante" old_variant
SET
  "sku" = 'TONER-RICOH-C5100-K',
  "nombreVariante" = 'Toner negro',
  "precioReferencia" = 21250,
  "atributosVarianteJson" = jsonb_build_object(
    'color', 'Negro',
    'canal', 'negro',
    'rendimientoPaginasIso', 16000,
    'equipoCompatible', 'Ricoh PRO C5100',
    'presentacion', 'Cartucho',
    'oemOAlternativo', 'OEM'
  ),
  "updatedAt" = now()
FROM "MateriaPrima" mp
WHERE old_variant."materiaPrimaId" = mp."id"
  AND old_variant."tenantId" = mp."tenantId"
  AND mp."codigo" = 'TONER-CMYK-RICOH'
  AND old_variant."sku" = 'TONER-CMYK-RICOH-PACK'
  AND NOT EXISTS (
    SELECT 1
    FROM "MateriaPrimaVariante" existing
    WHERE existing."tenantId" = old_variant."tenantId"
      AND existing."sku" = 'TONER-RICOH-C5100-K'
  );

WITH mp AS (
  SELECT "id", "tenantId"
  FROM "MateriaPrima"
  WHERE "codigo" = 'TONER-CMYK-RICOH'
),
variants("sku", "nombre", "color", "canal") AS (
  VALUES
    ('TONER-RICOH-C5100-C', 'Toner cian', 'Cian', 'cian'),
    ('TONER-RICOH-C5100-M', 'Toner magenta', 'Magenta', 'magenta'),
    ('TONER-RICOH-C5100-Y', 'Toner amarillo', 'Amarillo', 'amarillo'),
    ('TONER-RICOH-C5100-K', 'Toner negro', 'Negro', 'negro')
)
INSERT INTO "MateriaPrimaVariante" (
  "id",
  "tenantId",
  "materiaPrimaId",
  "sku",
  "nombreVariante",
  "activo",
  "precioReferencia",
  "moneda",
  "atributosVarianteJson",
  "createdAt",
  "updatedAt"
)
SELECT
  (
    substr(md5(mp."tenantId"::text || ':' || variants."sku"), 1, 8) || '-' ||
    substr(md5(mp."tenantId"::text || ':' || variants."sku"), 9, 4) || '-' ||
    '4' || substr(md5(mp."tenantId"::text || ':' || variants."sku"), 14, 3) || '-' ||
    '8' || substr(md5(mp."tenantId"::text || ':' || variants."sku"), 18, 3) || '-' ||
    substr(md5(mp."tenantId"::text || ':' || variants."sku"), 21, 12)
  )::uuid,
  mp."tenantId",
  mp."id",
  variants."sku",
  variants."nombre",
  true,
  21250,
  'ARS',
  jsonb_build_object(
    'color', variants."color",
    'canal', variants."canal",
    'rendimientoPaginasIso', 16000,
    'equipoCompatible', 'Ricoh PRO C5100',
    'presentacion', 'Cartucho',
    'oemOAlternativo', 'OEM'
  ),
  now(),
  now()
FROM mp
CROSS JOIN variants
WHERE NOT EXISTS (
  SELECT 1
  FROM "MateriaPrimaVariante" existing
  WHERE existing."tenantId" = mp."tenantId"
    AND existing."sku" = variants."sku"
);

UPDATE "MateriaPrimaVariante"
SET "activo" = false, "updatedAt" = now()
WHERE "sku" = 'TONER-CMYK-RICOH-PACK';

UPDATE "MateriaPrimaVariante" old_variant
SET
  "sku" = 'TINTA-LATEX-ROLAND-C',
  "nombreVariante" = 'Tinta latex cian 500ml',
  "atributosVarianteJson" = jsonb_build_object(
    'tecnologiaCompatible', 'impresora_gran_formato_por_area',
    'color', 'Cian',
    'canal', 'cian',
    'volumenPresentacion', 500,
    'volumenMl', 500,
    'equipoCompatible', 'Roland TrueVIS VG3'
  ),
  "updatedAt" = now()
FROM "MateriaPrima" mp
WHERE old_variant."materiaPrimaId" = mp."id"
  AND old_variant."tenantId" = mp."tenantId"
  AND mp."codigo" = 'TINTA-LATEX-ROLAND'
  AND old_variant."sku" = 'TINTA-LATEX-ROLAND-CART'
  AND NOT EXISTS (
    SELECT 1
    FROM "MateriaPrimaVariante" existing
    WHERE existing."tenantId" = old_variant."tenantId"
      AND existing."sku" = 'TINTA-LATEX-ROLAND-C'
  );

WITH mp AS (
  SELECT "id", "tenantId"
  FROM "MateriaPrima"
  WHERE "codigo" = 'TINTA-LATEX-ROLAND'
),
variants("sku", "nombre", "color", "canal") AS (
  VALUES
    ('TINTA-LATEX-ROLAND-C', 'Tinta latex cian 500ml', 'Cian', 'cian'),
    ('TINTA-LATEX-ROLAND-M', 'Tinta latex magenta 500ml', 'Magenta', 'magenta'),
    ('TINTA-LATEX-ROLAND-Y', 'Tinta latex amarillo 500ml', 'Amarillo', 'amarillo'),
    ('TINTA-LATEX-ROLAND-K', 'Tinta latex negro 500ml', 'Negro', 'negro')
)
INSERT INTO "MateriaPrimaVariante" (
  "id",
  "tenantId",
  "materiaPrimaId",
  "sku",
  "nombreVariante",
  "activo",
  "precioReferencia",
  "moneda",
  "atributosVarianteJson",
  "createdAt",
  "updatedAt"
)
SELECT
  (
    substr(md5(mp."tenantId"::text || ':' || variants."sku"), 1, 8) || '-' ||
    substr(md5(mp."tenantId"::text || ':' || variants."sku"), 9, 4) || '-' ||
    '4' || substr(md5(mp."tenantId"::text || ':' || variants."sku"), 14, 3) || '-' ||
    '8' || substr(md5(mp."tenantId"::text || ':' || variants."sku"), 18, 3) || '-' ||
    substr(md5(mp."tenantId"::text || ':' || variants."sku"), 21, 12)
  )::uuid,
  mp."tenantId",
  mp."id",
  variants."sku",
  variants."nombre",
  true,
  45000,
  'ARS',
  jsonb_build_object(
    'tecnologiaCompatible', 'impresora_gran_formato_por_area',
    'color', variants."color",
    'canal', variants."canal",
    'volumenPresentacion', 500,
    'volumenMl', 500,
    'equipoCompatible', 'Roland TrueVIS VG3'
  ),
  now(),
  now()
FROM mp
CROSS JOIN variants
WHERE NOT EXISTS (
  SELECT 1
  FROM "MateriaPrimaVariante" existing
  WHERE existing."tenantId" = mp."tenantId"
    AND existing."sku" = variants."sku"
);

UPDATE "MateriaPrimaVariante"
SET "activo" = false, "updatedAt" = now()
WHERE "sku" = 'TINTA-LATEX-ROLAND-CART';

UPDATE "MateriaPrimaVariante" old_variant
SET
  "sku" = 'TINTA-UV-MIMAKI-C',
  "nombreVariante" = 'Tinta UV cian 600ml',
  "atributosVarianteJson" = jsonb_build_object(
    'tecnologiaCompatible', 'impresora_gran_formato_por_area',
    'color', 'Cian',
    'canal', 'cian',
    'volumenPresentacion', 600,
    'volumenMl', 600,
    'equipoCompatible', 'Mimaki UJF-7151'
  ),
  "updatedAt" = now()
FROM "MateriaPrima" mp
WHERE old_variant."materiaPrimaId" = mp."id"
  AND old_variant."tenantId" = mp."tenantId"
  AND mp."codigo" = 'TINTA-UV-MIMAKI'
  AND old_variant."sku" = 'TINTA-UV-MIMAKI-CART'
  AND NOT EXISTS (
    SELECT 1
    FROM "MateriaPrimaVariante" existing
    WHERE existing."tenantId" = old_variant."tenantId"
      AND existing."sku" = 'TINTA-UV-MIMAKI-C'
  );

WITH mp AS (
  SELECT "id", "tenantId"
  FROM "MateriaPrima"
  WHERE "codigo" = 'TINTA-UV-MIMAKI'
),
variants("sku", "nombre", "color", "canal") AS (
  VALUES
    ('TINTA-UV-MIMAKI-C', 'Tinta UV cian 600ml', 'Cian', 'cian'),
    ('TINTA-UV-MIMAKI-M', 'Tinta UV magenta 600ml', 'Magenta', 'magenta'),
    ('TINTA-UV-MIMAKI-Y', 'Tinta UV amarillo 600ml', 'Amarillo', 'amarillo'),
    ('TINTA-UV-MIMAKI-K', 'Tinta UV negro 600ml', 'Negro', 'negro'),
    ('TINTA-UV-MIMAKI-W', 'Tinta UV blanco 600ml', 'Blanco', 'blanco'),
    ('TINTA-UV-MIMAKI-V', 'Barniz UV 600ml', 'Barniz', 'barniz')
)
INSERT INTO "MateriaPrimaVariante" (
  "id",
  "tenantId",
  "materiaPrimaId",
  "sku",
  "nombreVariante",
  "activo",
  "precioReferencia",
  "moneda",
  "atributosVarianteJson",
  "createdAt",
  "updatedAt"
)
SELECT
  (
    substr(md5(mp."tenantId"::text || ':' || variants."sku"), 1, 8) || '-' ||
    substr(md5(mp."tenantId"::text || ':' || variants."sku"), 9, 4) || '-' ||
    '4' || substr(md5(mp."tenantId"::text || ':' || variants."sku"), 14, 3) || '-' ||
    '8' || substr(md5(mp."tenantId"::text || ':' || variants."sku"), 18, 3) || '-' ||
    substr(md5(mp."tenantId"::text || ':' || variants."sku"), 21, 12)
  )::uuid,
  mp."tenantId",
  mp."id",
  variants."sku",
  variants."nombre",
  true,
  65000,
  'ARS',
  jsonb_build_object(
    'tecnologiaCompatible', 'impresora_gran_formato_por_area',
    'color', variants."color",
    'canal', variants."canal",
    'volumenPresentacion', 600,
    'volumenMl', 600,
    'equipoCompatible', 'Mimaki UJF-7151'
  ),
  now(),
  now()
FROM mp
CROSS JOIN variants
WHERE NOT EXISTS (
  SELECT 1
  FROM "MateriaPrimaVariante" existing
  WHERE existing."tenantId" = mp."tenantId"
    AND existing."sku" = variants."sku"
);

UPDATE "MateriaPrimaVariante"
SET "activo" = false, "updatedAt" = now()
WHERE "sku" = 'TINTA-UV-MIMAKI-CART';

UPDATE "MateriaPrimaVariante"
SET
  "nombreVariante" = CASE "sku"
    WHEN 'TONER-RICOH-C5100-C' THEN 'Tóner cian'
    WHEN 'TONER-RICOH-C5100-M' THEN 'Tóner magenta'
    WHEN 'TONER-RICOH-C5100-Y' THEN 'Tóner amarillo'
    WHEN 'TONER-RICOH-C5100-K' THEN 'Tóner negro'
    WHEN 'TINTA-LATEX-ROLAND-C' THEN 'Tinta látex cian 500ml'
    WHEN 'TINTA-LATEX-ROLAND-M' THEN 'Tinta látex magenta 500ml'
    WHEN 'TINTA-LATEX-ROLAND-Y' THEN 'Tinta látex amarillo 500ml'
    WHEN 'TINTA-LATEX-ROLAND-K' THEN 'Tinta látex negro 500ml'
    ELSE "nombreVariante"
  END,
  "updatedAt" = now()
WHERE "sku" IN (
  'TONER-RICOH-C5100-C',
  'TONER-RICOH-C5100-M',
  'TONER-RICOH-C5100-Y',
  'TONER-RICOH-C5100-K',
  'TINTA-LATEX-ROLAND-C',
  'TINTA-LATEX-ROLAND-M',
  'TINTA-LATEX-ROLAND-Y',
  'TINTA-LATEX-ROLAND-K'
);

UPDATE "MateriaPrimaVariante"
SET
  "atributosVarianteJson" = jsonb_set(
    "atributosVarianteJson",
    '{material}',
    to_jsonb('Celofán'::text),
    true
  ),
  "updatedAt" = now()
WHERE "sku" = 'BOLSA-100';
