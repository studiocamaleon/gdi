-- Alineación de drift preexistente, sin efecto funcional.
--
-- Las tablas del ETA quedaron con un DEFAULT de base en `id` que el schema de
-- Prisma no declara (los ids los genera la app, ver la migración
-- `20260720070000_id_sin_default_en_base`, que hizo lo mismo con el resto).
-- No rompe nada, pero aparece en CADA `prisma migrate diff` y ensucia las
-- migraciones de features que no tienen nada que ver.

ALTER TABLE "EtaPromesa" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "EtaSnapshotEstacion" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "EtaSnapshotItem" ALTER COLUMN "id" DROP DEFAULT;
