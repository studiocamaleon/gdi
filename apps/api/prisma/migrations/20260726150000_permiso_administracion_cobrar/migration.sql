-- Llave suelta para registrar cobros.
--
-- Tomar la seña es parte de cerrar la venta: el Vendedor cobra en el mostrador
-- y el Administrativo concilia después. Hasta acá cobrar pedía
-- `administracion.gestionar`, que el Vendedor no tiene, así que los cobros que
-- cargaba en la ficha de la orden fallaban con un 403 al emitirla — y no había
-- forma de arreglarlo sin darle la administración entera (comprobantes,
-- tesorería, cuentas).
--
-- Ver docs/usuarios-roles-permisos-diseno.md

-- 1) Nadie pierde lo que ya tenía: quien hoy cobra por `administracion.gestionar`
--    sigue cobrando (el endpoint acepta cualquiera de los dos permisos), pero se
--    le da igual la llave nueva para que su rol diga lo que hace.
UPDATE "Rol"
SET "permisos" = "permisos" || ARRAY['administracion.cobrar']::TEXT[]
WHERE 'administracion.gestionar' = ANY("permisos")
  AND NOT ('administracion.cobrar' = ANY("permisos"));

-- 2) El motivo del cambio: el Vendedor de fábrica la recibe sin ganar nada más.
--    Sólo el rol del sistema — un rol a medida que el tenant creó no gana
--    permisos sin que alguien lo decida.
UPDATE "Rol"
SET "permisos" = "permisos" || ARRAY['administracion.cobrar']::TEXT[]
WHERE "codigo" = 'vendedor'
  AND "esDelSistema" = true
  AND NOT ('administracion.cobrar' = ANY("permisos"));
