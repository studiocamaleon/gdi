ALTER TABLE "CotizacionItem" ALTER COLUMN "productoId" DROP NOT NULL;
ALTER TABLE "CotizacionItem" ADD COLUMN "origen" TEXT NOT NULL DEFAULT 'CATALOGO';
ALTER TABLE "CotizacionItem" ADD CONSTRAINT "CotizacionItem_origen_producto_check"
  CHECK (("origen" = 'CATALOGO' AND "productoId" IS NOT NULL)
    OR ("origen" = 'TRABAJO_MEDIDA' AND "productoId" IS NULL));
-- Sólo el rol Administrador del sistema recibe el permiso por defecto.
UPDATE "Rol" SET "permisos" = array_append("permisos", 'comercial.trabajos_medida')
WHERE "codigo" = 'administrador' AND "esDelSistema" = true
  AND NOT ('comercial.trabajos_medida' = ANY("permisos"));
