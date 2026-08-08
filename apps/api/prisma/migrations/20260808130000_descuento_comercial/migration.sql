-- Descuento comercial de la línea (F1). Aditivo y nullable: el efecto del
-- descuento ya vive dentro de subtotal/impuestos/total; estos campos son la
-- traza (tipo + valor ingresado + monto neto descontado) y el denormalizado
-- de la orden para el listado.
ALTER TABLE "OrdenTrabajo" ADD COLUMN "descuentoTotal" DECIMAL(14,2);

ALTER TABLE "OrdenTrabajoItem" ADD COLUMN "descuentoTipo" TEXT;
ALTER TABLE "OrdenTrabajoItem" ADD COLUMN "descuentoValor" DECIMAL(14,2);
ALTER TABLE "OrdenTrabajoItem" ADD COLUMN "descuentoMonto" DECIMAL(14,2);

ALTER TABLE "CotizacionItem" ADD COLUMN "descuentoTipo" TEXT;
ALTER TABLE "CotizacionItem" ADD COLUMN "descuentoValor" DECIMAL(14,2);
ALTER TABLE "CotizacionItem" ADD COLUMN "descuentoMonto" DECIMAL(14,2);
