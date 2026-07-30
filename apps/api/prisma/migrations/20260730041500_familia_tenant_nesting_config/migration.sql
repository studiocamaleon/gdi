-- B.3.4 — el paso tenant puede acomodar piezas: superficie elegida en el
-- wizard. ADD COLUMN only, sin datos que migrar.
ALTER TABLE "FamiliaTenant" ADD COLUMN "nestingConfigJson" JSONB;
