-- Evita que un mismo costo directo se aplique dos veces por un doble click o
-- una reintento del navegador. No hay duplicados en los datos existentes.
CREATE UNIQUE INDEX "ProductoCargoDirectoPaso_tenantId_productoConfigPasoId_cargoDirectoCatalogoId_key"
ON "ProductoCargoDirectoPaso"("tenantId", "productoConfigPasoId", "cargoDirectoCatalogoId");

CREATE UNIQUE INDEX "ProductoCargoDirectoCotizacion_tenantId_productoId_cargoDirectoCatalogoId_key"
ON "ProductoCargoDirectoCotizacion"("tenantId", "productoId", "cargoDirectoCatalogoId");
