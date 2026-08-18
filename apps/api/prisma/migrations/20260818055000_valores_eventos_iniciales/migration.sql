-- Los valores anteriores a la trazabilidad ya tenían un estado válido, pero
-- su historial empezaba recién en la siguiente operación. Se agrega el hito
-- inicial sin inventar un usuario: queda explícitamente atribuido al sistema.
INSERT INTO "ValorEvento" (
  "id",
  "tenantId",
  "valorId",
  "tipo",
  "actorUserId",
  "actorNombre",
  "detalleJson",
  "createdAt"
)
SELECT
  gen_random_uuid(),
  v."tenantId",
  v."id",
  CASE WHEN v."origen" = 'tercero' THEN 'recibido' ELSE 'emitido' END,
  NULL,
  'Sistema (historial migrado)',
  jsonb_build_object('estadoAlMigrar', v."estado"),
  v."createdAt"
FROM "Valor" v
WHERE NOT EXISTS (
  SELECT 1
  FROM "ValorEvento" e
  WHERE e."tenantId" = v."tenantId"
    AND e."valorId" = v."id"
    AND e."tipo" = CASE
      WHEN v."origen" = 'tercero' THEN 'recibido'
      ELSE 'emitido'
    END
);
