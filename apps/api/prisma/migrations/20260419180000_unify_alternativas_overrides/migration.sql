-- P4.1 — Consolidación del modelo de variabilidad del paso.
--
-- Antes existían tres mecanismos distintos para representar que un paso
-- podía ejecutarse de múltiples maneras:
--   1. ProcesoOperacionAlternativa (override de máquina + perfil)
--   2. detalleJson.niveles[] (override de tiempos/productividad, legacy v1)
--   3. activacionV2 + condicionV2 (aspiracional, muerto)
--
-- Esta migración colapsa (1) y (2) en una sola entidad: Alternativa ahora
-- puede override tiempos/productividad/configNestingV2 además de máquina+perfil.
-- Los `niveles[]` se eliminan del JSON — el sistema está en desarrollo y las
-- pocas configuraciones existentes se re-crean como Alternativas.

-- 1) Extender ProcesoOperacionAlternativa con overrides de tiempos, productividad,
--    y configNestingV2. Todos opcionales — si null, se usa el valor base del paso.
ALTER TABLE "ProcesoOperacionAlternativa"
  ADD COLUMN "setupMin"           DECIMAL(12, 2),
  ADD COLUMN "cleanupMin"         DECIMAL(12, 2),
  ADD COLUMN "tiempoFijoMin"      DECIMAL(12, 2),
  ADD COLUMN "productividadBase"  DECIMAL(12, 4),
  ADD COLUMN "configNestingV2"    JSONB;

-- 2) Limpiar detalleJson.niveles en ProcesoOperacion.
UPDATE "ProcesoOperacion"
SET "detalleJson" = ("detalleJson" - 'niveles')
WHERE "detalleJson" ? 'niveles';

-- 3) Limpiar detalleJson.niveles en ProcesoOperacionPlantilla.
UPDATE "ProcesoOperacionPlantilla"
SET "detalleJson" = ("detalleJson" - 'niveles')
WHERE "detalleJson" ? 'niveles';
