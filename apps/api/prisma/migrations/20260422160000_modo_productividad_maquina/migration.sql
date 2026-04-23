-- Modo productividad: PRODUCTIVIDAD_MAQUINA.
--
-- Tercer modo del enum. Indica que la velocidad del paso la define el perfil
-- operativo de la máquina elegida al cotizar (no se declara en biblioteca).
-- El motor lee `op.perfilOperativo.productivityValue` en runtime.
--
-- Diferencia con FIJA:
--   - FIJA: la biblioteca declara `productividadBase` como valor numérico.
--   - PRODUCTIVIDAD_MAQUINA: la biblioteca solo declara que se usa la
--     máquina X; la velocidad efectiva la fija el perfil elegido.

ALTER TYPE "ModoProductividadProceso"
  ADD VALUE IF NOT EXISTS 'PRODUCTIVIDAD_MAQUINA' AFTER 'FIJA';
