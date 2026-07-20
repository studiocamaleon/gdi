-- Drift entre migraciones y schema: estas tres tablas se crearon con
-- migraciones escritas a mano que pusieron `DEFAULT gen_random_uuid()` en la
-- columna id, pero el schema declara `@default(uuid())`, que es un default
-- del lado de PRISMA (lo genera el cliente, no la base). Resultado: todo
-- `migrate diff` salía sucio con tres DROP DEFAULT, y ese ruido permanente
-- podía tapar drift real.
--
-- La fuente de verdad es el schema: las 86 columnas id del modelo usan
-- `@default(uuid())` y ninguna tabla de la base (ni dev ni test) tiene
-- default a nivel Postgres. Las que desentonan son estas tres migraciones.
--
-- Sobre bases ya existentes esto no cambia nada (nunca llegaron a tener el
-- default). Sí corrige las que se construyan desde cero replayando las
-- migraciones, que hasta ahora terminaban distintas del schema.
ALTER TABLE "ConfiguracionInsights" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "ConfiguracionProduccion" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "DiaNoLaborable" ALTER COLUMN "id" DROP DEFAULT;
