-- P3.b.5 — Cleanup post-erradicación de motores v1/v2.
-- El super motor universal es el único motor; todo lo que comparaba v1 vs v2
-- dejó de tener sentido.

-- 1) CotizacionShadowLog: la tabla quedó huérfana al borrar el dispatcher
--    shadow. Los 23 registros históricos de desarrollo se eliminan con el drop.
DROP TABLE IF EXISTS "CotizacionShadowLog";

-- 2) ProductoServicio.motorPreferido: flag que controlaba V1/V2/SHADOW. El
--    dispatcher ahora siempre usa super motor; el campo ya no se lee.
ALTER TABLE "ProductoServicio" DROP COLUMN IF EXISTS "motorPreferido";

-- 3) Enum MotorVersionPreferida: sin referencias, se elimina del tipo.
DROP TYPE IF EXISTS "MotorVersionPreferida";
