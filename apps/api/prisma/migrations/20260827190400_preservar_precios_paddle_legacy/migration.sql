CREATE TABLE "PlanPrecioLegacy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "planId" UUID NOT NULL,
  "priceId" TEXT NOT NULL,
  "ciclo" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanPrecioLegacy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlanPrecioLegacy_priceId_key" ON "PlanPrecioLegacy"("priceId");
CREATE INDEX "PlanPrecioLegacy_planId_idx" ON "PlanPrecioLegacy"("planId");
ALTER TABLE "PlanPrecioLegacy" ADD CONSTRAINT "PlanPrecioLegacy_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PlanPrecioLegacy" ("planId", "priceId", "ciclo")
SELECT "id", "paddlePriceId", 'mensual' FROM "Plan"
WHERE "codigo" IN ('taller', 'estudio', 'diamante') AND "paddlePriceId" IS NOT NULL
ON CONFLICT ("priceId") DO NOTHING;
INSERT INTO "PlanPrecioLegacy" ("planId", "priceId", "ciclo")
SELECT "id", "paddlePriceIdAnual", 'anual' FROM "Plan"
WHERE "codigo" IN ('taller', 'estudio', 'diamante') AND "paddlePriceIdAnual" IS NOT NULL
ON CONFLICT ("priceId") DO NOTHING;

UPDATE "Plan"
SET "paddlePriceId" = NULL,
    "paddlePriceIdAnual" = NULL,
    "paddleProductId" = NULL,
    "precioAnual" = NULL
WHERE "codigo" IN ('taller', 'estudio', 'diamante');
