ALTER TYPE "ArchivoEstado" ADD VALUE 'PURGANDO';
ALTER TABLE "Archivo" ADD COLUMN "bytesReservados" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "reservaHasta" TIMESTAMP(3);
ALTER TABLE "Archivo" ADD CONSTRAINT "Archivo_reserva_no_negativa" CHECK ("bytesReservados" >= 0);
CREATE INDEX "Archivo_tenantId_estado_reservaHasta_idx" ON "Archivo" ("tenantId", "estado", "reservaHasta");
