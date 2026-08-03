-- Se retira tiempoMinimoMin: se superponía con el setup/cleanup configurable
-- del centro de copiado (un setup de 1 min da el mismo piso por trabajo, de forma
-- más intuitiva). El centro sigue cobrando tiempo REAL (jobContext.tiempoReal).
ALTER TABLE "CentroCopiadoConfig" DROP COLUMN IF EXISTS "tiempoMinimoMin";
