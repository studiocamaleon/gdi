-- Normaliza registros históricos creados antes de que `activo` fuera una
-- proyección de estado operativo + configuración lista.
UPDATE "Maquina"
SET "activo" = false
WHERE "estadoConfiguracion" <> 'LISTA'
   OR "estado" <> 'ACTIVA';

UPDATE "Maquina"
SET "estado" = 'INACTIVA'
WHERE "estado" = 'ACTIVA'
  AND "activo" = false;
