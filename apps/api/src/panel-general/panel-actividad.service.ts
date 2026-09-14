import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, RolSistema } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type FilaActividad = {
  id: string;
  fecha: Date;
  tipo: string;
  titulo: string;
  detalle: string;
  actor: string | null;
  href: string | null;
};

/** Conserva los alcances personales que ya aplica PanelGeneralService. */
export function puedeConsultarActividadGeneral(auth: CurrentAuth) {
  const p = auth.permisos ?? new Set<string>();
  const comercialSoloPropio =
    p.has('comercial.gestionar') &&
    !p.has('administracion.gestionar') &&
    !p.has('produccion.gestionar') &&
    !p.has('reportes.ver_resumen');
  const perfilSoloProductivo =
    p.has('produccion.ver') &&
    (p.has('produccion.gestionar') || p.has('produccion.ejecutar')) &&
    !p.has('comercial.ver') &&
    !p.has('administracion.gestionar');
  return (
    auth.role === RolSistema.ADMINISTRADOR &&
    p.has('panel.ver') &&
    !comercialSoloPropio &&
    !perfilSoloProductivo
  );
}

/** Lee los historiales autoritativos sin copiarlos ni generar notificaciones personales.
 * Producción ya escribe OrdenTrabajoEvento: se excluye su duplicado del outbox.
 */
@Injectable()
export class PanelActividadService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(auth: CurrentAuth, cursorRaw?: string, limite = 30) {
    if (!puedeConsultarActividadGeneral(auth)) {
      throw new ForbiddenException(
        'La actividad general requiere una vista de administrador con alcance general.',
      );
    }
    let cursor: { fecha: string; id: string } | null = null;
    if (cursorRaw) {
      try {
        if (cursorRaw.length > 512) throw new Error();
        cursor = JSON.parse(Buffer.from(cursorRaw, 'base64url').toString()) as {
          fecha: string;
          id: string;
        };
        if (
          !cursor ||
          !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(cursor.fecha) ||
          !Number.isFinite(Date.parse(cursor.fecha)) ||
          !/^(orden|cliente|sistema):[a-f0-9-]{1,40}$/.test(cursor.id)
        )
          throw new Error();
      } catch {
        throw new BadRequestException('El cursor de actividad no es válido.');
      }
    }
    const comercial = auth.permisos?.has('comercial.ver');
    const produccion = auth.permisos?.has('produccion.ver');
    const fuentes: Prisma.Sql[] = [];
    if (comercial || produccion) {
      const tipos = comercial
        ? [
            'emision',
            'modificacion',
            'cancelacion',
            'estado',
            'item_agregado',
            'item_modificado',
            'item_quitado',
            'paso',
            'gate_operativo',
          ]
        : ['estado', 'paso', 'gate_operativo'];
      fuentes.push(Prisma.sql`
        SELECT 'orden:' || e.id::text AS id, e.fecha, 'orden.' || e.tipo AS tipo,
          'Orden ' || o.numero AS titulo, e.descripcion AS detalle,
          e."usuarioNombre" AS actor, '/produccion/ordenes/' || o.id::text AS href
        FROM "OrdenTrabajoEvento" e
        JOIN "OrdenTrabajo" o ON o.id = e."ordenId" AND o."tenantId" = ${auth.tenantId}::uuid
        WHERE e."tenantId" = ${auth.tenantId}::uuid AND e.tipo IN (${Prisma.join(tipos)})
      `);
    }
    if (comercial) {
      fuentes.push(Prisma.sql`
        SELECT 'cliente:' || e.id::text AS id, e."createdAt" AS fecha, 'cliente.' || e.tipo AS tipo,
          CASE WHEN e.tipo = 'creado' THEN 'Nuevo cliente agregado' ELSE 'Cliente actualizado' END AS titulo,
          c.nombre AS detalle, e."actorNombre" AS actor, '/comercial/clientes/' || c.id::text AS href
        FROM "ClienteEvento" e
        JOIN "Cliente" c ON c.id = e."clienteId" AND c."tenantId" = ${auth.tenantId}::uuid
        WHERE e."tenantId" = ${auth.tenantId}::uuid AND e.tipo IN ('creado', 'editado', 'habilitado', 'inhabilitado')
      `);
      fuentes.push(Prisma.sql`
        SELECT 'sistema:' || lpad(e.id::text, 20, '0') AS id, e."createdAt" AS fecha, e.tipo,
          e.titulo, e.mensaje AS detalle, e."actorNombre" AS actor, e.href
        FROM "EventoSistema" e WHERE e."tenantId" = ${auth.tenantId}::uuid
          AND (e.tipo LIKE 'documento.%' OR e.tipo LIKE 'campana.%'
            OR e.tipo IN ('archivo.orden_confirmado', 'archivo.cliente_confirmado', 'archivo.campana_confirmado'))
      `);
    } else if (produccion) {
      fuentes.push(Prisma.sql`
        SELECT 'sistema:' || lpad(e.id::text, 20, '0') AS id, e."createdAt" AS fecha, e.tipo,
          e.titulo, e.mensaje AS detalle, e."actorNombre" AS actor, e.href
        FROM "EventoSistema" e WHERE e."tenantId" = ${auth.tenantId}::uuid
          AND e.tipo = 'archivo.orden_confirmado'
      `);
    }
    if (!fuentes.length) return { items: [], siguienteCursor: null };
    const take = Math.max(1, Math.min(30, limite));
    const filas = await this.prisma.$queryRaw<FilaActividad[]>(Prisma.sql`
      SELECT * FROM (${Prisma.join(fuentes, ' UNION ALL ')}) actividad
      ${cursor ? Prisma.sql`WHERE (fecha, id COLLATE "C") < (${new Date(cursor.fecha)}, ${cursor.id} COLLATE "C")` : Prisma.empty}
      ORDER BY fecha DESC, id COLLATE "C" DESC LIMIT ${take + 1}
    `);
    const items = filas
      .slice(0, take)
      .map((fila) => ({ ...fila, fecha: fila.fecha.toISOString() }));
    const ultimo = items.at(-1);
    return {
      items,
      siguienteCursor:
        filas.length > take && ultimo
          ? Buffer.from(
              JSON.stringify({ fecha: ultimo.fecha, id: ultimo.id }),
            ).toString('base64url')
          : null,
    };
  }
}
