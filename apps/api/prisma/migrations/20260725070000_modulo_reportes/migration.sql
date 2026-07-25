-- El módulo `panel` pasa a llamarse `reportes`: las 8 vistas que vivían como
-- tabs del Panel general ahora son rutas propias bajo /reportes, y el permiso
-- significa exactamente lo mismo que antes ("ver las métricas del negocio").
--
-- El backfill NO es opcional. Los roles guardan sus permisos como texto en
-- `Rol.permisos`, y `expandir()` descarta en silencio toda clave que no esté en
-- el catálogo de código (auth/permisos.ts). Sin este UPDATE, el día del deploy
-- `panel.ver` deja de existir y TODOS los roles que lo tenían —incluido el
-- Administrador— se quedan sin Reportes.
--
-- `array_replace` conserva la posición y no duplica si ya estuviera migrado.
-- Ver docs/usuarios-roles-permisos-diseno.md

UPDATE "Rol"
SET "permisos" = array_replace("permisos", 'panel.ver', 'reportes.ver')
WHERE 'panel.ver' = ANY("permisos");

UPDATE "Rol"
SET "permisos" = array_replace("permisos", 'panel.gestionar', 'reportes.gestionar')
WHERE 'panel.gestionar' = ANY("permisos");

-- Permiso nuevo: el Resumen ejecutivo se separa del resto de Reportes porque
-- junta el negocio entero en una pantalla (margen, punto de equilibrio,
-- alertas). Se siembra SÓLO al rol Administrador de fábrica — un rol a medida
-- que el tenant creó no recibe permisos nuevos sin que nadie lo decida.
UPDATE "Rol"
SET "permisos" = "permisos" || ARRAY['reportes.ver_resumen']::TEXT[]
WHERE "codigo" = 'administrador'
  AND "esDelSistema" = true
  AND NOT ('reportes.ver_resumen' = ANY("permisos"));
