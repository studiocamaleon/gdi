ALTER TABLE "OrdenTrabajoItemPaso" ADD COLUMN "planificadoHasta" TIMESTAMP(3);
ALTER TABLE "PlanEntregaItem" ADD COLUMN "cambioEntregasAceptado" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "reprogramacionAplicadaRevisionId" UUID;
