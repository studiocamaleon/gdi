-- Todo rol predefinido puede consultar el Tablero de producción. La edición
-- operativa se separa en ejecutar, supervisar y configurar.
UPDATE "Rol"
SET "permisos" = "permisos" || ARRAY['produccion.ver']::TEXT[]
WHERE "esDelSistema" = true
  AND NOT ('produccion.ver' = ANY("permisos"))
  AND NOT ('produccion.gestionar' = ANY("permisos"));

-- El Operario deja de heredar configuración total: conserva sólo la ejecución.
UPDATE "Rol"
SET "permisos" = array_remove("permisos", 'produccion.gestionar')
                  || ARRAY['produccion.ver', 'produccion.ejecutar']::TEXT[]
WHERE "codigo" = 'operario'
  AND "esDelSistema" = true;

-- Evita duplicados si una instalación ya había recibido los permisos nuevos.
UPDATE "Rol"
SET "permisos" = ARRAY(SELECT DISTINCT unnest("permisos"))
WHERE "esDelSistema" = true;
