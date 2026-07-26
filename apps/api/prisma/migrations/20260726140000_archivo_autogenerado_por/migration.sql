-- Marca de qué automatismo produjo el archivo ("sello" = arte del configurador).
--
-- No se reusa `generado` a propósito: ese flag significa "documento del sistema"
-- —oculto del tab, único vigente por entidad, no borrable a mano— y el arte del
-- sello es lo contrario, un adjunto normal que el taller abre y descarga como
-- abriría el archivo que mandó el cliente. Esta columna sólo existe para poder
-- reemplazar el arte cuando el diseño cambia sin tocar lo que subió una persona.
ALTER TABLE "Archivo" ADD COLUMN "autogeneradoPor" TEXT;

-- Buscar "los artes de sello de este item" es la consulta que corre en cada
-- guardado de una orden con sellos.
CREATE INDEX "Archivo_autogeneradoPor_idx"
  ON "Archivo" ("ordenItemId", "autogeneradoPor")
  WHERE "autogeneradoPor" IS NOT NULL;
