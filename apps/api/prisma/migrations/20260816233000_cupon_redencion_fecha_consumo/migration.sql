-- Una reserva puede haberse creado en un mes y consumirse en otro. Guardamos
-- ambos hitos para que las métricas mensuales reflejen el consumo real.
ALTER TABLE "CuponRedencion"
  ADD COLUMN "consumidaEl" TIMESTAMP(3);

UPDATE "CuponRedencion"
SET "consumidaEl" = "createdAt"
WHERE "estado" = 'CONSUMIDA';
