INSERT INTO "ProveedorEvento" (
  "id", "tenantId", "proveedorId", "tipo", "actorNombre", "createdAt"
)
SELECT
  gen_random_uuid(), "tenantId", "id", 'creado', 'Sistema (dato histórico)', "createdAt"
FROM "Proveedor"
WHERE NOT EXISTS (
  SELECT 1 FROM "ProveedorEvento" evento
  WHERE evento."proveedorId" = "Proveedor"."id"
);
