-- Centro de Copiado forma parte del plan más alto. La actualización cubre
-- tanto instalaciones existentes como bases nuevas que recorran el historial.
UPDATE "Plan"
SET "featuresJson" = COALESCE("featuresJson", '{}'::jsonb)
  || '{"centroCopiado": true}'::jsonb
WHERE "codigo" = 'diamante';
