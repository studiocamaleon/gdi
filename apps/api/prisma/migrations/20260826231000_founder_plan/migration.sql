-- Plan interno del fundador. Sigue el circuito real de Paddle por USD 1/mes,
-- pero no forma parte de la oferta pública ni puede elegirse por autogestión.
ALTER TABLE "Plan"
  ADD COLUMN "publico" BOOLEAN NOT NULL DEFAULT true;

INSERT INTO "Plan" (
  "id",
  "codigo",
  "nombre",
  "descripcion",
  "precioMensual",
  "moneda",
  "featuresJson",
  "publico",
  "activo",
  "orden"
) VALUES (
  gen_random_uuid(),
  'founder',
  'Founder',
  'Plan interno del fundador con acceso completo.',
  1,
  'USD',
  '{"todo": true}',
  false,
  true,
  99
)
ON CONFLICT ("codigo") DO NOTHING;
