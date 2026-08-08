-- Entrega por ítem en el mostrador. Aditivo y nullable: las órdenes ya
-- entregadas siguen marcadas por su estado global, y estas columnas quedan
-- en null (una OT vieja no tiene traza de qué se llevó el cliente y cuándo).
ALTER TABLE "OrdenTrabajoItem" ADD COLUMN "entregadoEl" TIMESTAMP(3);
ALTER TABLE "OrdenTrabajoItem" ADD COLUMN "entregadoPorNombre" TEXT;
ALTER TABLE "OrdenTrabajoItem" ADD COLUMN "retiradoPorNombre" TEXT;
ALTER TABLE "OrdenTrabajoItem" ADD COLUMN "retiradoPorDni" TEXT;

-- Los ítems de órdenes YA entregadas se dan por entregados en la fecha de
-- la orden: si no, el mostrador las mostraría como pendientes de retiro.
UPDATE "OrdenTrabajoItem" i
SET "entregadoEl" = o."fechaEntregada"
FROM "OrdenTrabajo" o
WHERE i."ordenId" = o."id"
  AND o."estado" = 'entregada'
  AND o."fechaEntregada" IS NOT NULL;

CREATE INDEX "OrdenTrabajoItem_ordenId_entregadoEl_idx" ON "OrdenTrabajoItem"("ordenId", "entregadoEl");
