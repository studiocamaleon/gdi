-- Algunos perfiles históricos guardaron `detalleJson` como `null` JSON o como
-- arreglo. El detalle de un perfil siempre debe ser un objeto. Normalizamos la
-- forma y preservamos la cantidad de pasadas migrada cuando ya existe.
WITH perfiles_laminadora AS (
  SELECT
    perfil.id,
    CASE jsonb_typeof(perfil."detalleJson")
      WHEN 'object' THEN perfil."detalleJson"
      WHEN 'array' THEN
        CASE
          WHEN jsonb_typeof(perfil."detalleJson" -> -1) = 'object'
          THEN perfil."detalleJson" -> -1
          ELSE '{}'::jsonb
        END
      ELSE '{}'::jsonb
    END AS detalle_normalizado
  FROM "MaquinaPerfilOperativo" AS perfil
  JOIN "Maquina" AS maquina ON maquina.id = perfil."maquinaId"
  WHERE maquina.plantilla = 'LAMINADORA_BOPP_ROLLO'
)
UPDATE "MaquinaPerfilOperativo" AS perfil
SET "detalleJson" = normalizado.detalle_normalizado ||
  jsonb_build_object(
    'pasadasDobleFaz',
    COALESCE(
      normalizado.detalle_normalizado -> 'pasadasDobleFaz',
      '2'::jsonb
    )
  )
FROM perfiles_laminadora AS normalizado
WHERE perfil.id = normalizado.id;
