-- Elimina campos redundantes de formato comercial en impresoras laser.
-- La compatibilidad real se resuelve por dimensiones utiles y gramaje.

UPDATE "Maquina"
SET "parametrosTecnicosJson" = "parametrosTecnicosJson" - 'formatosPliegoSoportados'
WHERE "parametrosTecnicosJson" ? 'formatosPliegoSoportados';

UPDATE "MaquinaPerfilOperativo"
SET "detalleJson" = "detalleJson" - 'formatoSoportado'
WHERE "detalleJson" ? 'formatoSoportado';
