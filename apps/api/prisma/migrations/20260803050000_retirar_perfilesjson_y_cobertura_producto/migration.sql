-- Limpieza: se retiran dos columnas inertes de intentos previos de la cobertura
-- de tóner (ver docs/cobertura-toner-por-nivel-diseno.md):
--  * CentroCopiadoConfig.perfilesJson — el TPV pasó de "curar perfiles" a elegir
--    cobertura por documento (niveles fijos del sistema); ya no se curan perfiles.
--  * Producto.coberturaDefault — la cobertura default es POR PASO
--    (paramsPasoJson.coberturaDefault), no por producto.
-- Ninguna se llegó a usar en producción; el drop no afecta el costeo.
ALTER TABLE "CentroCopiadoConfig" DROP COLUMN IF EXISTS "perfilesJson";
ALTER TABLE "Producto" DROP COLUMN IF EXISTS "coberturaDefault";
