ALTER TABLE "PoliticaReservasMaterial" ADD COLUMN "inicioSinStock" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrdenTrabajo" ADD COLUMN "materialesInicioSinStock" BOOLEAN NOT NULL DEFAULT false;
