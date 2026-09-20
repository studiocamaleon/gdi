-- Las empresas que ya operan manualmente conservan esa elección.
-- Las nuevas activaciones proponen reservar al emitir, sin adoptar OTs antiguas.
ALTER TABLE "PoliticaReservasMaterial" ADD COLUMN "modo" VARCHAR(16) NOT NULL DEFAULT 'AL_EMITIR';
UPDATE "PoliticaReservasMaterial" SET "modo" = 'MANUAL' WHERE "habilitada" = true;
ALTER TABLE "PoliticaReservasMaterial" ADD CONSTRAINT "PoliticaReservasMaterial_modo_check" CHECK ("modo" IN ('AL_EMITIR', 'MANUAL'));
