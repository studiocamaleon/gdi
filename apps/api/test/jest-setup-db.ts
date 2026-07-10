/**
 * Aislamiento de la base de datos para tests.
 *
 * Los specs de la API tocan la base real con Prisma: `motor.spec.ts`
 * (`ensureCentrosManualesDemo`) upsertea tarifas publicadas de centros de
 * costo y reasigna el `centroCostoId` de los pasos de config sin máquina.
 * Corriendo contra la base de desarrollo eso PISA datos reales (incidente
 * 2026-07-10: 5 tarifas publicadas quedaron con valores planos de test y 40
 * pasos apuntando a VP-002 — ver docs/centros-de-costo-snapshot-2026-07.md).
 *
 * Este setup corre ANTES de cualquier import de los specs (jest `setupFiles`)
 * y fija DATABASE_URL a la base dedicada `gdi_saas_test`. Prisma respeta el
 * process.env ya seteado por encima del `.env`, así que ningún PrismaClient
 * de los tests puede llegar a `gdi_saas`.
 *
 * - La base de test se crea una vez con:
 *     docker exec gdi-saas-postgres psql -U postgres -c 'CREATE DATABASE gdi_saas_test;'
 *     DATABASE_URL="postgresql://postgres:postgres@localhost:5436/gdi_saas_test?schema=public" npx prisma migrate deploy
 * - Sin seed, los specs de integración (que buscan el tenant `gdi-demo`) se
 *   saltean solos y corren únicamente los tests unitarios. Si querés correr
 *   la suite de integración completa, seedeá `gdi_saas_test`.
 * - Para apuntar a otra base de test: exportá TEST_DATABASE_URL.
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5436/gdi_saas_test?schema=public';
