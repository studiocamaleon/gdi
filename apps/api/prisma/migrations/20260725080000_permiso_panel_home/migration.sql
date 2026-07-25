-- Vuelve el módulo `panel`, pero significando otra cosa que antes.
--
-- El viejo `panel.ver` gateaba las ocho vistas de inteligencia de negocio, y
-- por eso el Operario no lo tenía: se renombró a `reportes.ver` en la
-- migración anterior. Este `panel.ver` es el HOME —hoy vacío, su contenido se
-- diseña aparte— y es de TODOS, incluido el Operario.
--
-- Backfill a los cinco roles de fábrica. Un rol a medida que el tenant creó no
-- recibe permisos nuevos sin que nadie lo decida; si alguien quiere darle el
-- home, lo hace desde el editor de roles.
-- Ver docs/usuarios-roles-permisos-diseno.md

UPDATE "Rol"
SET "permisos" = "permisos" || ARRAY['panel.ver']::TEXT[]
WHERE "esDelSistema" = true
  AND "codigo" IN (
    'administrador',
    'jefe_produccion',
    'vendedor',
    'administrativo',
    'operario'
  )
  AND NOT ('panel.ver' = ANY("permisos"));
