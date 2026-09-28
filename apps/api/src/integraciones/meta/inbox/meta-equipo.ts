import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { puedeAtenderInbox } from '../meta-conexion-acceso';

export const selectOperador = {
  userId: true,
  rol: true,
  rolDelTenant: { select: { permisos: true } },
  user: { select: { nombreCompleto: true, email: true } },
} satisfies Prisma.MembershipSelect;
export const nombreOperador = (u: {
  nombreCompleto: string | null;
  email: string;
}) => u.nombreCompleto?.trim() || u.email;
export async function operadoresInbox(
  db: Pick<Prisma.TransactionClient, 'membership'>,
  tenantId: string,
) {
  const miembros = await db.membership.findMany({
    where: {
      tenantId,
      activa: true,
      user: { activo: true, debeCambiarPassword: false },
    },
    select: selectOperador,
  });
  return miembros
    .filter(puedeAtenderInbox)
    .map((m) => ({ id: m.userId, nombre: nombreOperador(m.user) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
export async function autoasignarInbox(
  tx: Prisma.TransactionClient,
  envio: {
    id: string;
    tenantId: string;
    vinculoId: string;
    conversacionId: string;
    usuarioId: string;
  },
  nombre: string,
) {
  const miembro = await tx.membership.findFirst({
    where: {
      tenantId: envio.tenantId,
      userId: envio.usuarioId,
      activa: true,
      user: { activo: true, debeCambiarPassword: false },
    },
    select: selectOperador,
  });
  if (!miembro || !puedeAtenderInbox(miembro)) return;
  const scope = {
    tenantId: envio.tenantId,
    vinculoId: envio.vinculoId,
    conversacionId: envio.conversacionId,
  };
  const cambio = await tx.inboxConversacion.updateMany({
    where: {
      id: envio.conversacionId,
      tenantId: envio.tenantId,
      vinculoId: envio.vinculoId,
      responsableId: null,
    },
    data: {
      responsableId: envio.usuarioId,
      responsableNombre: nombre,
      asignacionVersion: { increment: 1 },
    },
  });
  if (cambio.count)
    await tx.inboxEventoInterno.create({
      data: {
        ...scope,
        clave: envio.id,
        tipo: 'AUTOASIGNACION',
        actorId: envio.usuarioId,
        actorNombre: nombre,
        responsableId: envio.usuarioId,
        responsableNombre: nombre,
      },
    });
}
export async function leerEquipoInbox(
  db: Pick<Prisma.TransactionClient, 'inboxEventoInterno' | 'membership'>,
  c: {
    id: string;
    tenantId: string;
    vinculoId: string;
    responsableId: string | null;
    responsableNombre: string | null;
    asignacionVersion: number;
    estado: string;
    estadoVersion: number;
    entrantesRevision: number;
  },
  query: { eventosAntesDe?: string; eventosDesdeId?: string },
) {
  if (query.eventosAntesDe && query.eventosDesdeId)
    throw new BadRequestException(
      'Elegí una dirección para leer la actividad.',
    );
  const scope = {
    tenantId: c.tenantId,
    vinculoId: c.vinculoId,
    conversacionId: c.id,
  };
  const id = query.eventosAntesDe ?? query.eventosDesdeId;
  const ancla = id
    ? await db.inboxEventoInterno.findFirst({ where: { ...scope, id } })
    : null;
  if (id && !ancla)
    throw new NotFoundException('La actividad ya no está disponible.');
  const limite = query.eventosDesdeId ? 500 : 50;
  const eventos = await db.inboxEventoInterno.findMany({
    where: {
      ...scope,
      ...(ancla
        ? {
            OR: query.eventosAntesDe
              ? [
                  { createdAt: { lt: ancla.createdAt } },
                  { createdAt: ancla.createdAt, id: { lt: ancla.id } },
                ]
              : [
                  { createdAt: { gt: ancla.createdAt } },
                  { createdAt: ancla.createdAt, id: { gte: ancla.id } },
                ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limite + 1,
  });
  const pagina = eventos.slice(0, limite);
  const menor = pagina.at(-1);
  const mas =
    eventos.length > limite ||
    (query.eventosDesdeId &&
      menor &&
      (await db.inboxEventoInterno.findFirst({
        where: {
          ...scope,
          OR: [
            { createdAt: { lt: menor.createdAt } },
            { createdAt: menor.createdAt, id: { lt: menor.id } },
          ],
        },
        select: { id: true },
      })));
  const operadores = await operadoresInbox(db, c.tenantId);
  const actual = operadores.find((o) => o.id === c.responsableId);
  return {
    estado: c.estado,
    estadoVersion: c.estadoVersion,
    entrantesRevision: c.entrantesRevision,
    responsable: c.responsableId
      ? {
          id: c.responsableId,
          nombre:
            actual?.nombre ?? c.responsableNombre ?? 'Integrante anterior',
          disponible: Boolean(actual),
        }
      : null,
    version: c.asignacionVersion,
    operadores,
    anterior: mas && menor ? menor.id : null,
    eventos: pagina.reverse().map((e) => ({
      id: e.id,
      tipo: e.tipo,
      actor: { id: e.actorId, nombre: e.actorNombre },
      texto: e.texto,
      anterior: e.anteriorId
        ? { id: e.anteriorId, nombre: e.anteriorNombre }
        : null,
      responsable: e.responsableId
        ? { id: e.responsableId, nombre: e.responsableNombre }
        : null,
      creadoEl: e.createdAt.toISOString(),
    })),
  };
}
