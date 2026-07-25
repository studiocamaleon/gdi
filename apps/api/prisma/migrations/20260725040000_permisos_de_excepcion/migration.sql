-- Dos permisos nuevos del catálogo: aprobar un presupuesto bajo el margen
-- mínimo y anular movimientos de plata.
--
-- Hace falta backfill y no alcanza con agregarlos al catálogo de código: los
-- roles ya están sembrados en la base con la lista de permisos de entonces, y
-- `sembrarPredefinidos` sólo CREA los que faltan —no toca los existentes, a
-- propósito, para no pisar lo que el tenant personalizó—. Sin esto, el
-- administrador dejaría de poder aprobar descuentos el día del deploy.
--
-- Se agregan sólo a los roles DE FÁBRICA que corresponden. Un rol a medida que
-- el tenant creó no recibe permisos nuevos sin que nadie lo decida.
-- Ver docs/usuarios-roles-permisos-diseno.md

UPDATE "Rol"
SET "permisos" = "permisos" || ARRAY['comercial.aprobar_descuento', 'administracion.anular']::TEXT[]
WHERE "codigo" = 'administrador'
  AND "esDelSistema" = true
  AND NOT ('comercial.aprobar_descuento' = ANY("permisos"));

-- Quien maneja los cobros es quien corrige uno mal cargado.
UPDATE "Rol"
SET "permisos" = "permisos" || ARRAY['administracion.anular']::TEXT[]
WHERE "codigo" = 'administrativo'
  AND "esDelSistema" = true
  AND NOT ('administracion.anular' = ANY("permisos"));
