-- La cantidad de pasadas de doble faz afecta el tiempo del perfil operativo,
-- no las capacidades físicas de la máquina. Migramos la selección histórica
-- al perfil y dejamos en la máquina sólo los márgenes del rollo.
UPDATE "MaquinaPerfilOperativo" AS perfil
SET "detalleJson" = COALESCE(perfil."detalleJson", '{}'::jsonb) ||
  jsonb_build_object(
    'pasadasDobleFaz',
    CASE
      WHEN (
        COALESCE(maquina."parametrosTecnicosJson", '{}'::jsonb)
          -> 'modosOperacionSoportados'
      ) ? 'DOS_CARAS_1_PASADA'
      THEN 1
      ELSE 2
    END
  )
FROM "Maquina" AS maquina
WHERE perfil."maquinaId" = maquina.id
  AND maquina.plantilla = 'LAMINADORA_BOPP_ROLLO'
  AND NOT (COALESCE(perfil."detalleJson", '{}'::jsonb) ? 'pasadasDobleFaz');

UPDATE "Maquina"
SET "parametrosTecnicosJson" =
  COALESCE("parametrosTecnicosJson", '{}'::jsonb) - 'modosOperacionSoportados'
WHERE plantilla = 'LAMINADORA_BOPP_ROLLO'
  AND COALESCE("parametrosTecnicosJson", '{}'::jsonb)
    ? 'modosOperacionSoportados';
