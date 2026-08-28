-- Producción es el plan funcionalmente completo recomendado. Enterprise parte
-- de exactamente esas funciones y sólo amplía usuarios y acompañamiento.
UPDATE "Plan"
SET "featuresJson" = "featuresJson" || '{"centroCopiado":true}'::jsonb
WHERE "codigo" IN ('estudio', 'diamante');
