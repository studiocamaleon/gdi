-- Gastos fijos pasa a usar el catálogo de categorías de Cuentas por pagar
-- (CategoriaEgreso) en lugar del enum propio de 11 valores. Así el gasto
-- presupuestado y el pago real se clasifican con la misma vara.
--
-- El enum se convierte ANTES de borrarse: primero se agrega la FK nullable,
-- se backfillea por código, y recién ahí se exige NOT NULL.

ALTER TABLE "GastoFijoEstructura" ADD COLUMN "categoriaEgresoId" UUID;

-- Cada valor del enum tiene su equivalente en el catálogo. AMORTIZACION no:
-- el catálogo es de egresos de caja y la amortización no mueve caja, así que
-- cae en otros_gastos junto con el resto de lo que no matchee.
UPDATE "GastoFijoEstructura" g
SET "categoriaEgresoId" = c.id
FROM "CategoriaEgreso" c
WHERE c."tenantId" = g."tenantId"
  AND c.codigo = CASE g.categoria::text
    WHEN 'ALQUILER'     THEN 'alquiler'
    WHEN 'SUELDOS'      THEN 'sueldos'
    WHEN 'SERVICIOS'    THEN 'servicios'
    WHEN 'FINANCIEROS'  THEN 'bancarios'
    WHEN 'IMPUESTOS'    THEN 'impuestos_tasas'
    WHEN 'MARKETING'    THEN 'marketing'
    WHEN 'SEGUROS'      THEN 'seguros'
    WHEN 'SOFTWARE'     THEN 'software'
    WHEN 'LEGAL'        THEN 'honorarios'
    ELSE 'otros_gastos'
  END;

-- Red de contención: si a un tenant le faltaba la categoría del mapeo, va a
-- otros_gastos antes que quedar sin clasificar.
UPDATE "GastoFijoEstructura" g
SET "categoriaEgresoId" = c.id
FROM "CategoriaEgreso" c
WHERE g."categoriaEgresoId" IS NULL
  AND c."tenantId" = g."tenantId"
  AND c.codigo = 'otros_gastos';

-- Si ni siquiera existe otros_gastos, la migración se planta acá con un
-- mensaje claro en vez de romper con un NOT NULL críptico.
DO $$
DECLARE huerfanos INT;
BEGIN
  SELECT count(*) INTO huerfanos
  FROM "GastoFijoEstructura" WHERE "categoriaEgresoId" IS NULL;
  IF huerfanos > 0 THEN
    RAISE EXCEPTION 'Quedaron % gastos fijos sin categoría: al tenant le falta el catálogo de egresos (seed de CategoriaEgreso).', huerfanos;
  END IF;
END $$;

ALTER TABLE "GastoFijoEstructura" ALTER COLUMN "categoriaEgresoId" SET NOT NULL;
ALTER TABLE "GastoFijoEstructura" DROP COLUMN "categoria";
DROP TYPE "CategoriaGastoFijo";

CREATE INDEX "GastoFijoEstructura_tenantId_categoriaEgresoId_idx" ON "GastoFijoEstructura"("tenantId", "categoriaEgresoId");

ALTER TABLE "GastoFijoEstructura"
  ADD CONSTRAINT "GastoFijoEstructura_categoriaEgresoId_fkey"
  FOREIGN KEY ("categoriaEgresoId") REFERENCES "CategoriaEgreso"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
