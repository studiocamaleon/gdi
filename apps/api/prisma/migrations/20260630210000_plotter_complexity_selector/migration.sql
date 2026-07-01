UPDATE "MaquinaPerfilOperativo" AS p
SET
  "detalleJson" = jsonb_set(
    COALESCE(p."detalleJson", '{}'::jsonb),
    '{factorComplejidad}',
    to_jsonb(
      (
        CASE
          WHEN p."productivityValue" IS NULL THEN 'simple'
          WHEN ABS(p."productivityValue"::numeric - 36) < 0.001 THEN 'simple'
          WHEN ABS(p."productivityValue"::numeric - 54) < 0.001 THEN 'intermedio'
          WHEN ABS(p."productivityValue"::numeric - 90) < 0.001 THEN 'complejo'
          ELSE 'personalizado'
        END
      )::text
    ),
    true
  ),
  "productivityValue" = COALESCE(p."productivityValue", 36),
  "productivityUnit" = 'M2_H'
FROM "Maquina" AS m
WHERE p."maquinaId" = m.id
  AND m."plantilla" = 'PLOTTER_DE_CORTE'
  AND (
    p."detalleJson" IS NULL
    OR jsonb_typeof(p."detalleJson"->'factorComplejidad') IS DISTINCT FROM 'string'
    OR p."detalleJson"->>'factorComplejidad' NOT IN (
      'simple',
      'intermedio',
      'complejo',
      'personalizado'
    )
  );
