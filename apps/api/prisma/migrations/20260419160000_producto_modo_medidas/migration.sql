-- P3.a.2 — Formalizar el concepto de "modoMedidas" en ProductoServicio.
-- Antes vivía como flag implícita en cada motor (hiddenTabs hardcodeado) o
-- como parámetro dentro del JSON motorConfig.parametros. Ahora es un
-- atributo first-class del producto, discoverable y unificado para todos
-- los motores del modelo universal.
--
--   ESTANDAR → el producto tiene variantes con medidas fijas (SKUs).
--              Las cotizaciones usan las medidas de la variante elegida.
--   LIBRE    → el cliente ingresa las medidas al cotizar. El producto
--              no tiene variantes (o las oculta en la UI).

CREATE TYPE "ModoMedidasProducto" AS ENUM ('ESTANDAR', 'LIBRE');

ALTER TABLE "ProductoServicio"
  ADD COLUMN "modoMedidas" "ModoMedidasProducto" NOT NULL DEFAULT 'ESTANDAR';

-- Backfill basado en semántica existente:
-- 1) gran_formato y vinilo_de_corte son LIBRE por naturaleza.
UPDATE "ProductoServicio"
SET "modoMedidas" = 'LIBRE'
WHERE "motorCodigo" IN ('gran_formato', 'vinilo_de_corte');

-- 2) rigidos_impresos con motorConfig.parametros.modoMedidas='libres' (config
--    motor-específica heredada) → LIBRE. El resto de rigidos queda ESTANDAR.
UPDATE "ProductoServicio" AS p
SET "modoMedidas" = 'LIBRE'
FROM "ProductoMotorConfig" AS c
WHERE c."productoServicioId" = p.id
  AND c."parametrosJson"->>'modoMedidas' = 'libres'
  AND p."motorCodigo" = 'rigidos_impresos';

CREATE INDEX "ProductoServicio_tenantId_modoMedidas_idx"
  ON "ProductoServicio"("tenantId", "modoMedidas");
