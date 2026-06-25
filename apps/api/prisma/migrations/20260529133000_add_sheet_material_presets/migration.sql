-- Agrega presets canónicos de Sustrato hoja a la biblioteca de materias primas.
-- La migración es idempotente: actualiza presets/variantes existentes por key y SKU.

DO $$
DECLARE
  preset jsonb;
  spec jsonb;
  preset_id uuid;
  formato text;
  gramaje int;
  size_label text;
  ancho numeric;
  alto numeric;
  sku text;
  acabado_code text;
  variant_order int;
  preset_order int := 100;
BEGIN
  FOR preset IN
    SELECT * FROM jsonb_array_elements($json$
    [
      {
        "key": "PAPEL_OBRA",
        "nombre": "Papel obra",
        "descripcion": "Papel blanco no estucado para formularios, papelería comercial, interiores y piezas de uso general.",
        "icon": "paper",
        "tipo": "obra",
        "aliases": ["Papel obra", "Bond", "Offset", "Natural", "Book", "Papel blanco"],
        "usos": ["impresion_offset", "impresion_digital", "papeleria_comercial"],
        "procesos": ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
        "advertencias": []
      },
      {
        "key": "PAPEL_OBRA_AHUESADO",
        "nombre": "Papel obra ahuesado",
        "descripcion": "Papel no estucado color marfil o crema, usado en editorial, libros, agendas y piezas de lectura.",
        "icon": "paper",
        "tipo": "obra_ahuesado",
        "aliases": ["Papel obra ahuesado", "Bookcel", "Bookcell", "Bond ahuesado", "Papel marfil", "Papel crema"],
        "usos": ["impresion_offset", "impresion_digital", "editorial"],
        "procesos": ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
        "advertencias": []
      },
      {
        "key": "ILUSTRACION_MATE",
        "nombre": "Papel ilustración mate",
        "descripcion": "Papel estucado de acabado mate para folletería, tarjetas, catálogos y piezas comerciales.",
        "icon": "coated",
        "tipo": "ilustracion_mate",
        "aliases": ["Papel ilustración mate", "Couché mate", "Couche mate", "Cuché mate", "Estucado mate", "Encapado mate", "Propalcote mate"],
        "usos": ["impresion_offset", "impresion_digital", "folleteria"],
        "procesos": ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
        "advertencias": []
      },
      {
        "key": "ILUSTRACION_BRILLANTE",
        "nombre": "Papel ilustración brillante",
        "descripcion": "Papel estucado de acabado brillante para piezas con mayor viveza de color y terminación comercial.",
        "icon": "coated",
        "tipo": "ilustracion_brillante",
        "aliases": ["Papel ilustración brillante", "Couché brillante", "Couche brillante", "Cuché brillante", "Estucado brillante", "Esmaltado", "Glossy"],
        "usos": ["impresion_offset", "impresion_digital", "folleteria"],
        "procesos": ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
        "advertencias": []
      },
      {
        "key": "OPALINA",
        "nombre": "Opalina",
        "descripcion": "Cartulina premium blanca o marfil para tarjetas, invitaciones, certificados y piezas de presentación.",
        "icon": "paper",
        "tipo": "opalina",
        "aliases": ["Opalina", "Cartulina opalina", "Opalina blanca", "Opalina marfil", "Cartulina premium"],
        "usos": ["impresion_digital", "tarjeteria", "papeleria_comercial"],
        "procesos": ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
        "advertencias": []
      },
      {
        "key": "AUTOCOPIATIVO_CB",
        "nombre": "Papel autocopiativo CB",
        "descripcion": "Primera hoja de formularios autocopiativos, recubierta al dorso para transferir escritura.",
        "icon": "copy",
        "tipo": "autocopiativo_cb",
        "aliases": ["Autocopiativo CB", "Papel químico CB", "NCR CB", "Carbonless CB", "Primera hoja", "Original"],
        "usos": ["formularios", "talonarios", "impresion_offset"],
        "procesos": ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
        "advertencias": []
      },
      {
        "key": "AUTOCOPIATIVO_CFB",
        "nombre": "Papel autocopiativo CFB",
        "descripcion": "Hoja intermedia de formularios autocopiativos, recubierta en frente y dorso.",
        "icon": "copy",
        "tipo": "autocopiativo_cfb",
        "aliases": ["Autocopiativo CFB", "Papel químico CFB", "NCR CFB", "Carbonless CFB", "Hoja intermedia", "Duplicado"],
        "usos": ["formularios", "talonarios", "impresion_offset"],
        "procesos": ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
        "advertencias": []
      },
      {
        "key": "AUTOCOPIATIVO_CF",
        "nombre": "Papel autocopiativo CF",
        "descripcion": "Última hoja de formularios autocopiativos, recubierta en el frente para recibir la copia.",
        "icon": "copy",
        "tipo": "autocopiativo_cf",
        "aliases": ["Autocopiativo CF", "Papel químico CF", "NCR CF", "Carbonless CF", "Última hoja", "Triplicado"],
        "usos": ["formularios", "talonarios", "impresion_offset"],
        "procesos": ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
        "advertencias": []
      },
      {
        "key": "ADHESIVO_PAPEL",
        "nombre": "Papel adhesivo",
        "descripcion": "Papel autoadhesivo en hoja para etiquetas, stickers y calcomanías de uso general.",
        "icon": "adhesive",
        "tipo": "adhesivo_papel",
        "aliases": ["Papel adhesivo", "Autoadhesivo", "Stickers", "Etiquetas", "Calcomanía", "Pegatina", "Papel label"],
        "usos": ["impresion_digital", "etiquetas", "stickers"],
        "procesos": ["impresion_por_hoja", "guillotina", "plotter_de_corte"],
        "advertencias": ["El gramaje es referencial: puede variar según frontal, adhesivo y liner del proveedor."]
      },
      {
        "key": "KRAFT",
        "nombre": "Papel kraft",
        "descripcion": "Papel o cartulina kraft color natural para etiquetas, packaging liviano y piezas rústicas.",
        "icon": "kraft",
        "tipo": "kraft",
        "aliases": ["Papel kraft", "Cartulina kraft", "Kraft natural", "Kraft marrón", "Papel estraza"],
        "usos": ["packaging", "etiquetas", "papeleria_comercial"],
        "procesos": ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
        "advertencias": []
      }
    ]
    $json$::jsonb)
  LOOP
    INSERT INTO "MaterialPreset" (
      key,
      "nombreCanonico",
      "descripcionCorta",
      familia,
      subfamilia,
      "tipoTecnico",
      "templateId",
      "iconKind",
      "aliasDisponiblesJson",
      "usosRecomendadosJson",
      "procesosCompatiblesJson",
      "advertenciasJson",
      orden,
      activo,
      "createdAt",
      "updatedAt"
    )
    VALUES (
      preset->>'key',
      preset->>'nombre',
      preset->>'descripcion',
      'SUSTRATO'::"FamiliaMateriaPrima",
      'SUSTRATO_HOJA'::"SubfamiliaMateriaPrima",
      preset->>'tipo',
      'sustrato_hoja_v1',
      preset->>'icon',
      preset->'aliases',
      preset->'usos',
      preset->'procesos',
      preset->'advertencias',
      preset_order,
      true,
      now(),
      now()
    )
    ON CONFLICT (key) DO UPDATE
    SET
      "nombreCanonico" = EXCLUDED."nombreCanonico",
      "descripcionCorta" = EXCLUDED."descripcionCorta",
      familia = EXCLUDED.familia,
      subfamilia = EXCLUDED.subfamilia,
      "tipoTecnico" = EXCLUDED."tipoTecnico",
      "templateId" = EXCLUDED."templateId",
      "iconKind" = EXCLUDED."iconKind",
      "aliasDisponiblesJson" = EXCLUDED."aliasDisponiblesJson",
      "usosRecomendadosJson" = EXCLUDED."usosRecomendadosJson",
      "procesosCompatiblesJson" = EXCLUDED."procesosCompatiblesJson",
      "advertenciasJson" = EXCLUDED."advertenciasJson",
      activo = true,
      "updatedAt" = now();
    preset_order := preset_order + 1;
  END LOOP;

  FOR spec IN
    SELECT * FROM jsonb_array_elements($json$
    [
      {"key":"PAPEL_OBRA","prefix":"OBRA","formatos":["A4","A3","SRA3","65 x 95 cm"],"gramajes":[75,80,90,120],"material":"Papel obra","color":"Blanco","acabado":"Mate","recomendadas":["A4-80","A3-80","65 x 95 cm-80","65 x 95 cm-90"],"ordenBase":0},
      {"key":"PAPEL_OBRA_AHUESADO","prefix":"OBRA-AH","formatos":["A4","A3","65 x 95 cm"],"gramajes":[80,90],"material":"Papel obra ahuesado","color":"Marfil","acabado":"Mate","recomendadas":["A4-80","65 x 95 cm-80"],"ordenBase":0},
      {"key":"ILUSTRACION_MATE","prefix":"ILU-M","formatos":["SRA3","65 x 95 cm","72 x 102 cm"],"gramajes":[90,115,150,170,200,250,300,350],"material":"Papel ilustración","color":"Blanco","acabado":"Mate","recomendadas":["SRA3-150","65 x 95 cm-115","65 x 95 cm-150","65 x 95 cm-300"],"ordenBase":0},
      {"key":"ILUSTRACION_BRILLANTE","prefix":"ILU-B","formatos":["SRA3","65 x 95 cm","72 x 102 cm"],"gramajes":[90,115,150,170,200,250,300,350],"material":"Papel ilustración","color":"Blanco","acabado":"Brillo","recomendadas":["SRA3-150","65 x 95 cm-115","65 x 95 cm-150","65 x 95 cm-300"],"ordenBase":0},
      {"key":"OPALINA","prefix":"OPA","formatos":["A4","A3","SRA3","50 x 70 cm","65 x 45 cm"],"gramajes":[180,200,220,250,300,350],"material":"Opalina","color":"Blanco","acabado":"Mate","recomendadas":["A4-250","SRA3-300","65 x 45 cm-300"],"ordenBase":0},
      {"key":"AUTOCOPIATIVO_CB","prefix":"AUTO-CB","formatos":["22 x 34 cm"],"gramajes":[56,60],"material":"Autocopiativo CB","color":"Blanco","acabado":"Mate","recomendadas":["22 x 34 cm-56"],"ordenBase":0},
      {"key":"AUTOCOPIATIVO_CFB","prefix":"AUTO-CFB","formatos":["22 x 34 cm"],"gramajes":[56,60],"material":"Autocopiativo CFB","color":"Rosa","acabado":"Mate","recomendadas":["22 x 34 cm-56"],"ordenBase":0},
      {"key":"AUTOCOPIATIVO_CF","prefix":"AUTO-CF","formatos":["22 x 34 cm"],"gramajes":[56,60],"material":"Autocopiativo CF","color":"Celeste","acabado":"Mate","recomendadas":["22 x 34 cm-56"],"ordenBase":0},
      {"key":"ADHESIVO_PAPEL","prefix":"ADH-M","formatos":["A4","SRA3","65 x 95 cm"],"gramajes":[80,90],"material":"Papel adhesivo","color":"Blanco","acabado":"Mate","recomendadas":["A4-80","SRA3-80"],"ordenBase":0},
      {"key":"ADHESIVO_PAPEL","prefix":"ADH-B","formatos":["A4","SRA3","65 x 95 cm"],"gramajes":[80,90],"material":"Papel adhesivo","color":"Blanco","acabado":"Brillo","recomendadas":["A4-80","SRA3-80"],"ordenBase":100},
      {"key":"KRAFT","prefix":"KRAFT","formatos":["A4","50 x 70 cm","65 x 95 cm"],"gramajes":[120,180,250,300],"material":"Papel kraft","color":"Natural","acabado":"Mate","recomendadas":["A4-180","50 x 70 cm-250"],"ordenBase":0}
    ]
    $json$::jsonb)
  LOOP
    SELECT id INTO preset_id
    FROM "MaterialPreset"
    WHERE key = spec->>'key';

    variant_order := COALESCE((spec->>'ordenBase')::int, 0);
    FOR formato IN SELECT jsonb_array_elements_text(spec->'formatos')
    LOOP
      FOR gramaje IN SELECT (jsonb_array_elements_text(spec->'gramajes'))::int
      LOOP
        CASE formato
          WHEN 'A4' THEN ancho := 21; alto := 29.7;
          WHEN 'A3' THEN ancho := 29.7; alto := 42;
          WHEN 'SRA3' THEN ancho := 32; alto := 45;
          WHEN '65 x 95 cm' THEN ancho := 65; alto := 95;
          WHEN '72 x 102 cm' THEN ancho := 72; alto := 102;
          WHEN '50 x 70 cm' THEN ancho := 50; alto := 70;
          WHEN '65 x 45 cm' THEN ancho := 65; alto := 45;
          WHEN '22 x 34 cm' THEN ancho := 22; alto := 34;
          ELSE RAISE EXCEPTION 'Formato de hoja no soportado: %', formato;
        END CASE;

        size_label := replace(replace(replace(replace(formato, ' ', ''), 'x', 'X'), 'cm', ''), '.', 'P');
        acabado_code := CASE WHEN upper(spec->>'acabado') LIKE 'BR%' THEN 'B' ELSE 'M' END;
        sku := (spec->>'prefix') || '-' || size_label || '-' || gramaje::text || '-' || acabado_code;

        INSERT INTO "MaterialPresetVariante" (
          "presetId",
          "skuSugerido",
          "nombreVarianteSugerido",
          formato,
          espesor,
          color,
          recomendada,
          "atributosVarianteJson",
          "unidadStock",
          "unidadCompra",
          "precioReferencia",
          moneda,
          orden,
          activo,
          "createdAt",
          "updatedAt"
        )
        VALUES (
          preset_id,
          sku,
          formato || ' · ' || gramaje::text || ' g/m² · ' || (spec->>'material') || ' · ' || (spec->>'acabado'),
          formato,
          NULL,
          spec->>'color',
          (spec->'recomendadas') ? (formato || '-' || gramaje::text),
          jsonb_build_object(
            'formatoComercial', formato,
            'ancho', ancho,
            'alto', alto,
            'gramaje', gramaje,
            'material', spec->>'material',
            'color', spec->>'color',
            'acabado', spec->>'acabado',
            'anchoMm', round(ancho * 10),
            'altoMm', round(alto * 10),
            'largoMm', round(alto * 10),
            'gramajeGr', gramaje
          ),
          'HOJA'::"UnidadMateriaPrima",
          'RESMA'::"UnidadMateriaPrima",
          NULL,
          'ARS',
          variant_order,
          true,
          now(),
          now()
        )
        ON CONFLICT ("presetId", "skuSugerido") DO UPDATE
        SET
          "nombreVarianteSugerido" = EXCLUDED."nombreVarianteSugerido",
          formato = EXCLUDED.formato,
          espesor = NULL,
          color = EXCLUDED.color,
          recomendada = EXCLUDED.recomendada,
          "atributosVarianteJson" = EXCLUDED."atributosVarianteJson",
          "unidadStock" = EXCLUDED."unidadStock",
          "unidadCompra" = EXCLUDED."unidadCompra",
          moneda = EXCLUDED.moneda,
          orden = EXCLUDED.orden,
          activo = true,
          "updatedAt" = now();

        variant_order := variant_order + 1;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
