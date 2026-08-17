-- La guillotina guardaba el tiempo de corte a nivel máquina. Desde que el
-- ritmo puede variar por gramaje, el dato vive en cada perfil. Conservamos el
-- valor histórico como valor inicial cuando el perfil todavía no lo tiene.
UPDATE "MaquinaPerfilOperativo" p
SET "detalleJson" = COALESCE(p."detalleJson", '{}'::jsonb) ||
  jsonb_build_object(
    'tiempoPorCorteSeg',
    m."parametrosTecnicosJson"->'tiempoPorCorteSeg'
  )
FROM "Maquina" m
WHERE p."maquinaId" = m.id
  AND m.plantilla = 'GUILLOTINA'
  AND NOT (COALESCE(p."detalleJson", '{}'::jsonb) ? 'tiempoPorCorteSeg')
  AND jsonb_typeof(m."parametrosTecnicosJson"->'tiempoPorCorteSeg') = 'number'
  AND (m."parametrosTecnicosJson"->>'tiempoPorCorteSeg')::numeric > 0;

-- Estas plantillas no tienen una sección de repuestos. Una regla anterior las
-- marcaba incompletas por no cargar un dato que la interfaz no permitía cargar.
UPDATE "Maquina" m
SET "estadoConfiguracion" = 'LISTA'
WHERE m."estadoConfiguracion" = 'INCOMPLETA'
  AND m.plantilla = 'ANILLADORA'
  AND EXISTS (
    SELECT 1 FROM "MaquinaPerfilOperativo" p
    WHERE p."maquinaId" = m.id AND p.activo
      AND btrim(p.nombre) <> ''
      AND p."productivityValue" > 0
      AND p."productivityUnit" IS NOT NULL
      AND p."tipoPerfil" = 'FABRICACION'
      AND COALESCE(p."detalleJson"->>'tipoAnillo', '') <> ''
  )
  AND NOT EXISTS (
    SELECT 1 FROM "MaquinaPerfilOperativo" p
    WHERE p."maquinaId" = m.id AND p.activo
      AND (
        btrim(p.nombre) = '' OR p."productivityValue" IS NULL OR
        p."productivityValue" <= 0 OR p."productivityUnit" IS NULL OR
        p."tipoPerfil" <> 'FABRICACION' OR
        COALESCE(p."detalleJson"->>'tipoAnillo', '') = ''
      )
  );

UPDATE "Maquina" m
SET "estadoConfiguracion" = 'LISTA'
WHERE m."estadoConfiguracion" = 'INCOMPLETA'
  AND m.plantilla = 'LAMINADORA_BOPP_ROLLO'
  AND m."anchoUtil" > 0
  AND jsonb_array_length(
    COALESCE(m."parametrosTecnicosJson"->'modosOperacionSoportados', '[]'::jsonb)
  ) > 0
  AND COALESCE(m."parametrosTecnicosJson"->'margenesDesperdicioMm', '{}'::jsonb) <> '{}'::jsonb
  AND m."parametrosTecnicosJson" ? 'margenEntrePliegosMm'
  AND EXISTS (
    SELECT 1 FROM "MaquinaPerfilOperativo" p
    WHERE p."maquinaId" = m.id AND p.activo
      AND btrim(p.nombre) <> ''
      AND p."productivityValue" > 0
      AND p."productivityUnit" IS NOT NULL
      AND p."tipoPerfil" = 'LAMINADO'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "MaquinaPerfilOperativo" p
    WHERE p."maquinaId" = m.id AND p.activo
      AND (
        btrim(p.nombre) = '' OR p."productivityValue" IS NULL OR
        p."productivityValue" <= 0 OR p."productivityUnit" IS NULL OR
        p."tipoPerfil" <> 'LAMINADO'
      )
  );

UPDATE "Maquina" m
SET "estadoConfiguracion" = 'LISTA'
WHERE m."estadoConfiguracion" = 'INCOMPLETA'
  AND m.plantilla = 'PLANCHA_TERMICA'
  AND EXISTS (
    SELECT 1 FROM "MaquinaPerfilOperativo" p
    WHERE p."maquinaId" = m.id AND p.activo
      AND btrim(p.nombre) <> ''
      AND p."tipoPerfil" = 'FABRICACION'
      AND COALESCE((p."detalleJson"->>'tiempoPrensadoSeg')::numeric, 0) > 0
  )
  AND NOT EXISTS (
    SELECT 1 FROM "MaquinaPerfilOperativo" p
    WHERE p."maquinaId" = m.id AND p.activo
      AND (
        btrim(p.nombre) = '' OR p."tipoPerfil" <> 'FABRICACION' OR
        COALESCE((p."detalleJson"->>'tiempoPrensadoSeg')::numeric, 0) <= 0
      )
  );

-- Después del backfill, una guillotina con capacidades y perfiles completos
-- deja de depender del campo histórico a nivel máquina.
UPDATE "Maquina" m
SET "estadoConfiguracion" = 'LISTA'
WHERE m."estadoConfiguracion" = 'INCOMPLETA'
  AND m.plantilla = 'GUILLOTINA'
  AND m."anchoUtil" > 0 AND m."altoUtil" > 0
  AND EXISTS (
    SELECT 1 FROM "MaquinaPerfilOperativo" p
    WHERE p."maquinaId" = m.id AND p.activo
      AND btrim(p.nombre) <> ''
      AND p."tipoPerfil" = 'CORTE'
      AND COALESCE((p."detalleJson"->>'pliegosMaxPorTanda')::numeric, 0) > 0
      AND COALESCE((p."detalleJson"->>'gramajeMaxGr')::numeric, 0) > 0
      AND COALESCE((p."detalleJson"->>'tiempoPorCorteSeg')::numeric, 0) > 0
  )
  AND NOT EXISTS (
    SELECT 1 FROM "MaquinaPerfilOperativo" p
    WHERE p."maquinaId" = m.id AND p.activo
      AND (
        btrim(p.nombre) = '' OR p."tipoPerfil" <> 'CORTE' OR
        COALESCE((p."detalleJson"->>'pliegosMaxPorTanda')::numeric, 0) <= 0 OR
        COALESCE((p."detalleJson"->>'gramajeMaxGr')::numeric, 0) <= 0 OR
        COALESCE((p."detalleJson"->>'tiempoPorCorteSeg')::numeric, 0) <= 0
      )
  );
