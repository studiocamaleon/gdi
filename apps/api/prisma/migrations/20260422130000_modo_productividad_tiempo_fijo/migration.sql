-- Modo productividad: TIEMPO_FIJO.
-- Hasta hoy el enum tenía solo FIJA/FORMULA. La biblioteca de pasos
-- presentaba al usuario "Fija (tiempo total)" vs "Variable (valor+unidad)"
-- pero el modo "Fija" se mapeaba a FIJA del backend, donde el motor
-- interpreta FIJA como "productividad numérica" y NO usa tiempoFijoMin.
-- Resultado: pasos con "Fija (tiempo total)" cotizaban runMin ≈ 0.
--
-- Este migration agrega TIEMPO_FIJO al enum y re-etiqueta los pasos +
-- plantillas existentes que cumplen el patrón "tiempo fijo manual" para
-- que el motor los cotee correctamente.

ALTER TYPE "ModoProductividadProceso" ADD VALUE IF NOT EXISTS 'TIEMPO_FIJO' BEFORE 'FIJA';
