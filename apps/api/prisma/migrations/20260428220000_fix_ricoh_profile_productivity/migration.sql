UPDATE "MaquinaPerfilOperativo" AS perfil
SET "productivityValue" = 40.00,
    "updatedAt" = NOW()
FROM "Maquina" AS maquina
WHERE perfil."maquinaId" = maquina.id
  AND maquina.codigo = 'RICOH-PRO-C5100'
  AND perfil.nombre = 'Papel grueso simple faz'
  AND perfil."productivityUnit" = 'PPM'
  AND perfil."productivityValue" = 2400.00;

UPDATE "MaquinaPerfilOperativo" AS perfil
SET "productivityValue" = 20.00,
    "updatedAt" = NOW()
FROM "Maquina" AS maquina
WHERE perfil."maquinaId" = maquina.id
  AND maquina.codigo = 'RICOH-PRO-C5100'
  AND perfil.nombre = 'Papel grueso doble faz'
  AND perfil."productivityUnit" = 'PPM'
  AND perfil."productivityValue" = 1200.00;
