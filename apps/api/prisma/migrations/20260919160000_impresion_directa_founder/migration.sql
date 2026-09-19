-- Piloto opt-in: no se hereda de `todo` ni de las cuentas legacy.
UPDATE "Plan"
SET "featuresJson" = COALESCE("featuresJson", '{}'::jsonb) ||
  jsonb_build_object('impresionDirecta', "codigo" = 'founder');
