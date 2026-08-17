ALTER TABLE "public"."CentroCostoTarifaRevision"
ADD COLUMN "publicadaPor" TEXT;

UPDATE "public"."CentroCostoTarifaRevision"
SET "publicadaPor" = 'Migración histórica'
WHERE "publicadaPor" IS NULL;
