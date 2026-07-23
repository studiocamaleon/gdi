import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';

import type { PrismaService } from '../prisma/prisma.service';

/**
 * Lease para que un job programado corra en UNA sola instancia.
 *
 * Los crons viven dentro del proceso del API (`ScheduleModule.forRoot()`), así
 * que con dos instancias en Render cada job se dispara dos veces. Para los
 * barridos idempotentes eso es ruido; para el alta de plantillas de Wati es
 * quemar el doble del cupo de 10 por hora que impone Meta. El guard
 * `corriendo` que ya tienen los schedulers sólo protege dentro de su proceso.
 *
 * **Por qué un lease y no `pg_advisory_lock`.** El lock de sesión de Postgres
 * se toma y se suelta en la misma conexión, y Prisma usa un pool: la llamada
 * que libera puede caer en otra conexión y el lock queda tomado para siempre.
 * La variante de transacción (`pg_try_advisory_xact_lock`) se libera sola,
 * pero obliga a mantener una transacción abierta durante todo el job — para
 * Wati son minutos de I/O de red pinchando una conexión y bloqueando el
 * vacuum. El lease no tiene ninguno de los dos problemas.
 *
 * **Lo que hay que saber para usarlo bien:** el TTL tiene que ser mayor que lo
 * que tarda el job. Si se pasa, otra instancia lo toma y corren los dos. No es
 * un candado perfecto —eso pediría infraestructura que no tenemos— pero
 * convierte "siempre duplicado" en "duplicado sólo si un job se pasa de su
 * propia estimación", que es un problema mucho más chico y visible.
 */

/** Identifica al proceso. Cambia en cada arranque, y así debe ser. */
const INSTANCIA = randomUUID();

const logger = new Logger('CronLock');

/**
 * Corre `fn` sólo si consigue el lease de `nombre`.
 *
 * Devuelve `null` si no lo consiguió —otra instancia lo está corriendo— y lo
 * libera siempre, incluso si `fn` lanza.
 *
 * @param ttlSegundos cuánto vale el lease. Poné el peor caso del job, no el
 *   promedio: es lo único que evita que dos instancias se pisen.
 */
export async function conLockDeCron<T>(
  prisma: PrismaService,
  nombre: string,
  ttlSegundos: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  if (!(await tomar(prisma, nombre, ttlSegundos))) {
    logger.debug(`"${nombre}" ya lo está corriendo otra instancia.`);
    return null;
  }
  try {
    return await fn();
  } finally {
    await liberar(prisma, nombre);
  }
}

/**
 * El `WHERE` del `ON CONFLICT` es lo que hace atómica la toma: si la fila ya
 * existe y todavía no venció, el update no se aplica, no vuelve nada y esta
 * instancia sabe que perdió. Dos instancias corriendo el mismo INSERT en el
 * mismo instante no pueden ganar las dos — lo resuelve Postgres, no nosotros.
 */
async function tomar(
  prisma: PrismaService,
  nombre: string,
  ttlSegundos: number,
): Promise<boolean> {
  try {
    const filas = await prisma.$queryRawUnsafe<Array<{ nombre: string }>>(
      `INSERT INTO "CronLock" ("nombre", "tomadoEl", "expiraEl", "instancia")
       VALUES ($1, now(), now() + make_interval(secs => $2), $3)
       ON CONFLICT ("nombre") DO UPDATE
          SET "tomadoEl"  = now(),
              "expiraEl"  = now() + make_interval(secs => $2),
              "instancia" = $3
        WHERE "CronLock"."expiraEl" < now()
       RETURNING "nombre"`,
      nombre,
      ttlSegundos,
      INSTANCIA,
    );
    return filas.length > 0;
  } catch (error) {
    // Que falle el lock no puede tumbar el job: sin base tampoco habría nada
    // que hacer, y un error acá no debe verse como "el cron está roto".
    logger.error(
      `No se pudo tomar el lease de "${nombre}".`,
      error instanceof Error ? error.stack : String(error),
    );
    return false;
  }
}

/**
 * Libera venciendo el lease en vez de borrar la fila: queda registro de cuándo
 * corrió por última vez, que es lo primero que se mira cuando un job "no está
 * andando".
 *
 * El filtro por `instancia` importa: si nuestro lease venció a mitad del job y
 * otra instancia ya lo tomó, no somos quiénes para liberárselo.
 */
async function liberar(prisma: PrismaService, nombre: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "CronLock" SET "expiraEl" = now()
        WHERE "nombre" = $1 AND "instancia" = $2`,
      nombre,
      INSTANCIA,
    );
  } catch (error) {
    // Si no se pudo liberar, el TTL lo hace igual. No vale propagar.
    logger.warn(
      `No se pudo liberar el lease de "${nombre}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
