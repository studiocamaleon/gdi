-- Cambio aditivo: no recalcula ni modifica los cobros históricos.
ALTER TABLE "MetodoPago"
 ADD COLUMN "calendarioAcreditacion" TEXT NOT NULL DEFAULT 'habiles_bancarios',
 ADD COLUMN "feriadosAdicionales" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 ADD COLUMN "retencionesConfig" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Cobro"
 ADD COLUMN "fechaAcreditacionReal" TIMESTAMP(3),
 ADD COLUMN "referenciaAcreditacion" VARCHAR(100),
 ADD COLUMN "configMetodoSnapshot" JSONB,
 ADD COLUMN "liquidacionEstimada" JSONB;
ALTER TABLE "RetencionPercepcion"
 ADD COLUMN "agente" TEXT NOT NULL DEFAULT 'no_informado',
 ADD COLUMN "reglaId" UUID,
 ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'confirmada';
ALTER TABLE "MetodoPago" ADD CONSTRAINT "MetodoPago_calendario_valido"
 CHECK ("calendarioAcreditacion" IN ('habiles_bancarios', 'corridos'));
ALTER TABLE "RetencionPercepcion" ADD CONSTRAINT "RetencionPercepcion_estado_valido"
 CHECK ("estado" IN ('estimada', 'confirmada'));
