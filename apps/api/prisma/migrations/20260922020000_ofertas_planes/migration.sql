ALTER TABLE "Plan" ADD COLUMN     "comercialVersionado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ofertaActualId" UUID;

ALTER TABLE "RegistroTenant" ADD COLUMN     "ofertaId" UUID;

ALTER TABLE "Suscripcion" ADD COLUMN     "cicloFacturacion" TEXT,
ADD COLUMN     "ofertaId" UUID;

CREATE TABLE "PlanOferta" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "entorno" TEXT NOT NULL,
    "trialDias" INTEGER,
    "registroPublico" BOOLEAN NOT NULL,
    "recomendado" BOOLEAN NOT NULL,
    "creadaEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadaPorId" UUID NOT NULL,
    "motivo" TEXT NOT NULL,

    CONSTRAINT "PlanOferta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanOfertaPrecio" (
    "id" UUID NOT NULL,
    "ofertaId" UUID NOT NULL,
    "entorno" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ciclo" TEXT NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "moneda" TEXT NOT NULL,
    "cantidadMaxima" INTEGER NOT NULL,

    CONSTRAINT "PlanOfertaPrecio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanOferta_planId_idx" ON "PlanOferta"("planId");

CREATE UNIQUE INDEX "PlanOferta_versionId_entorno_key" ON "PlanOferta"("versionId", "entorno");

CREATE UNIQUE INDEX "PlanOfertaPrecio_entorno_priceId_key" ON "PlanOfertaPrecio"("entorno", "priceId");

CREATE UNIQUE INDEX "PlanOfertaPrecio_ofertaId_tipo_ciclo_key" ON "PlanOfertaPrecio"("ofertaId", "tipo", "ciclo");

CREATE UNIQUE INDEX "Plan_ofertaActualId_key" ON "Plan"("ofertaActualId");

ALTER TABLE "Plan" ADD CONSTRAINT "Plan_ofertaActualId_fkey" FOREIGN KEY ("ofertaActualId") REFERENCES "PlanOferta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlanOferta" ADD CONSTRAINT "PlanOferta_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlanOferta" ADD CONSTRAINT "PlanOferta_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlanOfertaPrecio" ADD CONSTRAINT "PlanOfertaPrecio_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "PlanOferta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RegistroTenant" ADD CONSTRAINT "RegistroTenant_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "PlanOferta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "PlanOferta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Plan" ADD COLUMN "revisionOferta" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PlanOferta" ADD CONSTRAINT "PlanOferta_entorno_check" CHECK ("entorno" IN ('sandbox','production'));
ALTER TABLE "PlanOferta" ADD CONSTRAINT "PlanOferta_trial_check" CHECK (("trialDias" IS NULL OR "trialDias" BETWEEN 1 AND 90) AND (NOT "registroPublico" OR "trialDias" IS NOT NULL));
ALTER TABLE "PlanOfertaPrecio" ADD CONSTRAINT "PlanOfertaPrecio_condiciones_check" CHECK ("entorno" IN ('sandbox','production') AND "tipo" IN ('base','usuario') AND "ciclo" IN ('mensual','anual') AND "importe" > 0 AND "moneda" = 'USD' AND "cantidadMaxima" BETWEEN 1 AND 10000);
CREATE FUNCTION proteger_oferta_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Las ofertas y los vínculos de precios son inmutables';
END;
$$;
CREATE TRIGGER "PlanOferta_inmutable" BEFORE UPDATE OR DELETE ON "PlanOferta" FOR EACH ROW EXECUTE FUNCTION proteger_oferta_plan();
CREATE TRIGGER "PlanOfertaPrecio_inmutable" BEFORE UPDATE OR DELETE ON "PlanOfertaPrecio" FOR EACH ROW EXECUTE FUNCTION proteger_oferta_plan();
