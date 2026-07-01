UPDATE "Maquina"
SET "unidadProduccionPrincipal" = 'M_MIN'
WHERE "plantilla" = 'LAMINADORA_BOPP_ROLLO'
  AND "unidadProduccionPrincipal" = 'MM_S';

UPDATE "MaquinaPerfilOperativo" AS perfil
SET
  "productivityUnit" = 'M_MIN',
  "productivityValue" = CASE
    WHEN perfil."productivityUnit" = 'MM_S' AND perfil."productivityValue" IS NOT NULL
      THEN perfil."productivityValue" * 60 / 1000
    ELSE perfil."productivityValue"
  END
FROM "Maquina" AS maquina
WHERE perfil."maquinaId" = maquina.id
  AND maquina."plantilla" = 'LAMINADORA_BOPP_ROLLO';
