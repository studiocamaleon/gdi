import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { instanteDe, sumarDiasAClave } from '../common/zona';
import { PrismaService } from '../prisma/prisma.service';
import { PanelActividadService } from './panel-actividad.service';

@Injectable()
export class PanelAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actividad: PanelActividadService,
  ) {}

  async obtener(auth: CurrentAuth, hoy: string, zona: string) {
    const veProduccion = auth.permisos?.has('produccion.ver');
    const [actividad, pasosCompletadosHoy, pendientes] = await Promise.all([
      this.actividad.listar(auth, undefined, 4),
      veProduccion
        ? this.prisma.ordenTrabajoItemPaso.count({
            where: {
              tenantId: auth.tenantId,
              estado: 'hecho',
              OR: [
                { nestingLoteRol: null },
                { nestingLoteRol: { not: 'PARTICIPANTE' } },
              ],
              completadoEl: {
                gte: instanteDe(hoy, '00:00', zona),
                lt: instanteDe(sumarDiasAClave(hoy, 1), '00:00', zona),
              },
            },
          })
        : Promise.resolve(null),
      veProduccion
        ? this.prisma.$queryRaw<
            Array<{
              id: string;
              numero: string;
              requisitos: number;
              total: number;
            }>
          >(Prisma.sql`
        SELECT o.id, o.numero, COUNT(*)::int AS requisitos, COUNT(*) OVER()::int AS total
        FROM "GateProduccionDocumento" g
        JOIN "OrdenTrabajo" o ON o.id = g."ordenId" AND o."tenantId" = ${auth.tenantId}::uuid
        JOIN "ArchivoMaestro" m ON m.id = g."archivoMaestroId" AND m."tenantId" = ${auth.tenantId}::uuid
        WHERE g."tenantId" = ${auth.tenantId}::uuid AND g.activo
          AND o.estado IN ('pendiente', 'produccion')
          AND NOT EXISTS (
            SELECT 1 FROM "SolicitudAprobacionDocumento" s
            WHERE s."tenantId" = ${auth.tenantId}::uuid AND s."revisionId" = m."revisionLiberadaId"
              AND s.estado = 'APROBADA' AND s.tipo = g."tipoAprobacion"
          )
        GROUP BY o.id, o.numero ORDER BY o.numero LIMIT 20
      `)
        : Promise.resolve([]),
    ]);
    return {
      actividad,
      pasosCompletadosHoy,
      documentacionPendiente: {
        total: pendientes[0]?.total ?? 0,
        ordenes: pendientes.map(({ id, numero, requisitos }) => ({
          id,
          numero,
          requisitos,
          href: `/produccion/ordenes/${id}`,
        })),
      },
    };
  }
}
