UPDATE "Maquina"
SET "espesorMaximo" = "espesorMaximo" * 1000
WHERE "plantilla" = 'LAMINADORA_BOPP_ROLLO'
  AND "espesorMaximo" IS NOT NULL
  AND "espesorMaximo" <= 10;
