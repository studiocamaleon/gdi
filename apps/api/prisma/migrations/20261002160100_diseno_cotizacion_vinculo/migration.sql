-- El nuevo enum ya existe al ejecutar esta migración. Conserva las FK de todos los otros ámbitos.
ALTER TABLE "Archivo" DROP CONSTRAINT "Archivo_scope_fk_coherente";

ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_scope_fk_coherente" CHECK (
      (("scope" = 'CLIENTE')     = ("clienteId"     IS NOT NULL))
  AND (("scope" = 'ORDEN')       = ("ordenId"       IS NOT NULL))
  AND (("scope" = 'ORDEN_ITEM')  = ("ordenItemId"   IS NOT NULL))
  AND (("scope" = 'COMPROBANTE') = ("comprobanteId" IS NOT NULL))
  AND (("scope" = 'COBRO')       = ("cobroId"       IS NOT NULL))
  AND (("scope" IN ('PRODUCTO', 'DISENO_COTIZACION'))    = ("productoId"    IS NOT NULL))
  AND (("scope" = 'PROVEEDOR')   = ("proveedorId"   IS NOT NULL))
  AND ("cotizacionId" IS NULL OR "scope" IN ('COTIZACION', 'ORDEN', 'ORDEN_ITEM'))
  AND ("scope" <> 'COTIZACION' OR "cotizacionId" IS NOT NULL)
);
