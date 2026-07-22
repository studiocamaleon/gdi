-- Al convertir un presupuesto en OT, sus archivos pasan a colgar de la orden
-- pero CONSERVAN `cotizacionId` como traza de origen (no se copian bytes, se
-- agrega la FK). El CHECK original sólo contemplaba esa convivencia para
-- ORDEN_ITEM; hace falta también para ORDEN.
-- Ver docs/archivos-r2-diseno.md §4.

ALTER TABLE "Archivo" DROP CONSTRAINT "Archivo_scope_fk_coherente";

ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_scope_fk_coherente" CHECK (
      (("scope" = 'CLIENTE')     = ("clienteId"     IS NOT NULL))
  AND (("scope" = 'ORDEN')       = ("ordenId"       IS NOT NULL))
  AND (("scope" = 'ORDEN_ITEM')  = ("ordenItemId"   IS NOT NULL))
  AND (("scope" = 'COMPROBANTE') = ("comprobanteId" IS NOT NULL))
  AND (("scope" = 'COBRO')       = ("cobroId"       IS NOT NULL))
  AND (("scope" = 'PRODUCTO')    = ("productoId"    IS NOT NULL))
  AND (("scope" = 'PROVEEDOR')   = ("proveedorId"   IS NOT NULL))
  AND ("cotizacionId" IS NULL OR "scope" IN ('COTIZACION', 'ORDEN', 'ORDEN_ITEM'))
  AND ("scope" <> 'COTIZACION' OR "cotizacionId" IS NOT NULL)
);
