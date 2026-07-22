-- Subida en partes para archivos que no entran en un solo PUT. El uploadId se
-- guarda para poder ABORTAR la subida desde el barrido nocturno: S3 y R2
-- cobran el espacio de las partes de un multipart que nunca se cerró, y sin
-- esta columna quedarían facturándose para siempre sin que nada las vea.
-- Ver docs/archivos-r2-diseno.md §5 (F4).

ALTER TABLE "Archivo" ADD COLUMN "multipartUploadId" TEXT;
