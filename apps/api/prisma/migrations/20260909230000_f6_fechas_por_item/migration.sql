ALTER TABLE "OrdenTrabajoItem" ADD COLUMN "fechaEntrega" DATE;

-- Las órdenes anteriores sólo persistían la fecha global. Se conserva como
-- respaldo de sus renglones comerciales, sin inventar fechas por componente.
UPDATE "OrdenTrabajoItem" AS item
SET "fechaEntrega" = orden."fechaEntrega"
FROM "OrdenTrabajo" AS orden
WHERE item."ordenId" = orden."id" AND item."parentItemId" IS NULL;
