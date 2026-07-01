UPDATE "Maquina"
SET "unidadProduccionPrincipal" = 'MM_S'
WHERE "plantilla" = 'LAMINADORA_BOPP_ROLLO'
  AND "unidadProduccionPrincipal" = 'M_MIN';

UPDATE "MaquinaPerfilOperativo" AS perfil
SET
  "productivityUnit" = 'MM_S',
  "productivityValue" = CASE
    WHEN perfil."productivityUnit" = 'M_MIN' AND perfil."productivityValue" IS NOT NULL
      THEN perfil."productivityValue" / 60
    ELSE perfil."productivityValue"
  END,
  "feedReloadMin" = NULL
FROM "Maquina" AS maquina
WHERE perfil."maquinaId" = maquina.id
  AND maquina."plantilla" = 'LAMINADORA_BOPP_ROLLO';
