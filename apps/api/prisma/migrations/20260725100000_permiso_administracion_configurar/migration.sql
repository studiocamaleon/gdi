-- Llave suelta para Datos fiscales y Métodos de pago.
--
-- Las dos pantallas viven en Configuración porque se definen una vez, pero son
-- del dominio de quien cobra y factura. Hasta acá se veían con
-- `configuracion.ver`, así que sólo llegaba el Administrador: el Administrativo
-- tenía que pedirle a alguien que corrigiera un CUIT o cargara un medio de pago.
-- Dárselo abriéndole `configuracion.ver` le habría abierto también Usuarios —o
-- sea crear cuentas y repartir roles—, que es justo lo que no se quiere.
--
-- Ver docs/usuarios-roles-permisos-diseno.md

-- 1) Nadie pierde lo que ya tenía. El sidebar pasó a tratar el permiso del hijo
--    como REEMPLAZO del permiso del grupo: sin esto, un rol con
--    `configuracion.ver` dejaría de ver las dos pantallas de un día para el
--    otro. Se le da la llave a todo el que hoy entra a Configuración —de
--    fábrica o a medida—, así que para ellos no cambia nada.
UPDATE "Rol"
SET "permisos" = "permisos" || ARRAY['administracion.configurar']::TEXT[]
WHERE ('configuracion.ver' = ANY("permisos") OR 'configuracion.gestionar' = ANY("permisos"))
  AND NOT ('administracion.configurar' = ANY("permisos"));

-- 2) Y ahora sí, el motivo del cambio: el Administrativo de fábrica la recibe
--    sin tener Configuración. Sólo el rol del sistema — un rol a medida que el
--    tenant creó no gana permisos sin que alguien lo decida.
UPDATE "Rol"
SET "permisos" = "permisos" || ARRAY['administracion.configurar']::TEXT[]
WHERE "codigo" = 'administrativo'
  AND "esDelSistema" = true
  AND NOT ('administracion.configurar' = ANY("permisos"));
