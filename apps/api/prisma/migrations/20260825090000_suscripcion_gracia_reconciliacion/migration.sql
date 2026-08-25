ALTER TABLE "Suscripcion"
  ADD COLUMN "moraDesde" TIMESTAMP(3),
  ADD COLUMN "graciaHasta" TIMESTAMP(3),
  ADD COLUMN "ultimaSyncProveedorEl" TIMESTAMP(3),
  ADD COLUMN "ultimoEventoProveedorEl" TIMESTAMP(3);

ALTER TABLE "EventoCobro"
  ADD COLUMN "ocurridoEl" TIMESTAMP(3);

CREATE INDEX "Suscripcion_graciaHasta_idx" ON "Suscripcion"("graciaHasta");
