import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import type { PrismaService } from '../prisma/prisma.service';

export type TrabajoEmision = {
  ordenId: string;
  tenantId: string;
  usuarioId: string;
  usuarioNombre: string;
  planificar: boolean;
  preparar: boolean;
  fechasDiferidas: boolean;
  turno: string;
};

/** El número de OT y su trabajo pendiente se confirman en el mismo commit. */
export async function encolarEmision(
  tx: Prisma.TransactionClient,
  auth: CurrentAuth,
  ordenId: string,
  opciones: {
    planificar: boolean;
    preparar: boolean;
    fechasDiferidas: boolean;
  },
) {
  await tx.$executeRaw`
    INSERT INTO "TrabajoEmisionOt" ("ordenId", "tenantId", "usuarioId", "usuarioNombre", planificar, preparar, "fechasDiferidas")
    VALUES (${ordenId}::uuid, ${auth.tenantId}::uuid, ${auth.userId}::uuid,
      ${auth.impersonacion?.actorNombre ?? auth.email}, ${opciones.planificar}, ${opciones.preparar}, ${opciones.fechasDiferidas})
    ON CONFLICT ("ordenId") DO NOTHING`;
}

/** Transacción breve. Cada réplica toma hasta ocho OTs del mismo taller para
 * compartir el cálculo. El turno vence si muere el proceso que lo reclamó. */
export function reclamarEmisiones(db: PrismaService, soloTenant?: string) {
  return db.$transaction(async (tx) => {
    const [candidata] = await tx.$queryRaw<Array<{ tenantId: string }>>`
      SELECT t."tenantId" FROM "TrabajoEmisionOt" t
      LEFT JOIN "TurnoEmisionOt" ultimo ON ultimo."tenantId" = t."tenantId"
      WHERE t."disponibleEl" <= now()
        ${soloTenant ? Prisma.sql`AND t."tenantId" = ${soloTenant}::uuid` : Prisma.empty}
        AND NOT EXISTS (
        SELECT 1 FROM "TrabajoEmisionOt" otra WHERE otra."tenantId" = t."tenantId"
        AND otra.turno IS NOT NULL AND otra."disponibleEl" > now())
      ORDER BY ultimo."atendidoEl" ASC NULLS FIRST, t."disponibleEl", t."ordenId" LIMIT 1 FOR UPDATE OF t SKIP LOCKED`;
    if (!candidata) return [];
    const { tenantId } = candidata;
    const [lock] = await tx.$queryRaw<Array<{ ok: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtextextended(${tenantId}, 139)) AS ok`;
    if (!lock.ok) return [];
    const trabajos = await tx.$queryRaw<TrabajoEmision[]>`
      UPDATE "TrabajoEmisionOt" SET turno = ${randomUUID()}::uuid, "disponibleEl" = now() + interval '3 minutes'
      WHERE "ordenId" IN (SELECT "ordenId" FROM "TrabajoEmisionOt"
        WHERE "tenantId" = ${tenantId}::uuid AND "disponibleEl" <= now()
        AND NOT EXISTS (SELECT 1 FROM "TrabajoEmisionOt" WHERE "tenantId" = ${tenantId}::uuid
          AND turno IS NOT NULL AND "disponibleEl" > now())
        ORDER BY "disponibleEl", "ordenId" LIMIT 8 FOR UPDATE SKIP LOCKED)
      RETURNING *`;
    if (trabajos.length)
      await tx.$executeRaw`
      INSERT INTO "TurnoEmisionOt" ("tenantId", "atendidoEl") VALUES (${tenantId}::uuid, now())
      ON CONFLICT ("tenantId") DO UPDATE SET "atendidoEl" = excluded."atendidoEl"`;
    return trabajos;
  });
}

export async function reprogramarEmision(
  db: PrismaService,
  trabajo: TrabajoEmision,
) {
  await db.$executeRaw`UPDATE "TrabajoEmisionOt" SET turno = NULL, intentos = intentos + 1,
    "disponibleEl" = now() + make_interval(secs => least(900, 5 * (1 << least(intentos, 8))))
    WHERE "ordenId" = ${trabajo.ordenId}::uuid AND turno = ${trabajo.turno}::uuid`;
}
