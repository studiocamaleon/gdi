-- Rescata el gramaje comercial de los perfiles CAD existentes. Sólo se completa
-- una variante sin dato propio ni heredado cuando todos sus perfiles coinciden.
-- Nunca se infiere del nombre ni se modifica un gramaje ya definido.
WITH gramajes AS (
  SELECT p."tenantId", p."cad"->>'materialVarianteId' AS variante,
         MIN(p.gramaje) AS gramaje
  FROM "ImpresionPerfil" p
  WHERE p.tamano = 'CAD' AND p.gramaje > 0
  GROUP BY p."tenantId", p."cad"->>'materialVarianteId'
  HAVING COUNT(DISTINCT p.gramaje) = 1
)
UPDATE "MateriaPrimaVariante" v
SET "atributosVarianteJson" = COALESCE(v."atributosVarianteJson", '{}'::jsonb) ||
    jsonb_build_object('gramajeGr', g.gramaje), "updatedAt" = NOW()
FROM gramajes g, "MateriaPrima" m
WHERE v.id::text = g.variante AND v."tenantId" = g."tenantId"
  AND m.id = v."materiaPrimaId" AND m."tenantId" = v."tenantId"
  AND COALESCE(v."atributosVarianteJson"->>'gramajeGr', v."atributosVarianteJson"->>'gramaje',
               m."atributosTecnicosJson"->>'gramajeGr', m."atributosTecnicosJson"->>'gramaje') IS NULL;
