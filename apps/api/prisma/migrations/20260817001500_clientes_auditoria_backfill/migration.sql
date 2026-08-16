INSERT INTO "ClienteEvento" (
  "id", "tenantId", "clienteId", "tipo", "actorNombre", "createdAt"
)
SELECT
  gen_random_uuid(), "tenantId", "id", 'creado', 'Sistema (dato histórico)', "createdAt"
FROM "Cliente"
WHERE NOT EXISTS (
  SELECT 1 FROM "ClienteEvento" evento WHERE evento."clienteId" = "Cliente"."id"
);
