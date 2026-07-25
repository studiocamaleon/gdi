-- Un cliente que ya operó no se borra: se inhabilita.
--
-- Borrarlo dejaba las órdenes SIN CLIENTE en silencio. La relación
-- `OrdenTrabajo.cliente` es opcional y sin `onDelete` declarado, así que
-- Postgres pone null y nadie se entera hasta que alguien abre una orden vieja y
-- no sabe de quién era. Pasó de verdad: quedaron 4 órdenes, 5 cotizaciones y 5
-- comprobantes huérfanos.
--
-- Los comprobantes zafaron porque congelan `receptorSnapshot` al emitir —razón
-- social y CUIT quedan en el documento— pero las órdenes y las cotizaciones no
-- guardan nada equivalente.
--
-- Ver docs/clientes-inhabilitar-diseno.md

ALTER TABLE "Cliente" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

-- Índice por el filtro que ahora hace CADA listado de clientes.
CREATE INDEX "Cliente_tenantId_activo_idx" ON "Cliente"("tenantId", "activo");
