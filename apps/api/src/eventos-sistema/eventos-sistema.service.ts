import { Injectable, MessageEvent, NotFoundException } from '@nestjs/common';
import { Prisma, SeveridadNotificacionInterna } from '@prisma/client';
import { Observable } from 'rxjs';
import type { CurrentAuth } from '../auth/auth.types';
import { firmaActor } from '../common/firma-actor';
import { PrismaService } from '../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

export type PublicarEventoSistema = {
  tenantId: string;
  actorUserId?: string | null;
  actorNombre: string;
  tipo: string;
  entidadTipo: string;
  entidadId?: string | null;
  titulo: string;
  mensaje: string;
  href?: string | null;
  severidad?: SeveridadNotificacionInterna;
  topicos: string[];
  destinatariosUserId?: string[];
  proyectoCampanaId?: string;
  incluirActor?: boolean;
};

@Injectable()
export class EventosSistemaService {
  constructor(private readonly prisma: PrismaService) {}

  async publicar(input: PublicarEventoSistema, db: Db = this.prisma) {
    const destinatarios = new Set(input.destinatariosUserId ?? []);

    if (input.proyectoCampanaId) {
      const campana = await db.proyectoCampana.findFirst({
        where: {
          id: input.proyectoCampanaId,
          tenantId: input.tenantId,
        },
        select: {
          responsable: { select: { userId: true } },
          equipo: {
            select: { empleado: { select: { userId: true } } },
          },
        },
      });
      if (campana?.responsable?.userId) {
        destinatarios.add(campana.responsable.userId);
      }
      for (const miembro of campana?.equipo ?? []) {
        if (miembro.empleado.userId) destinatarios.add(miembro.empleado.userId);
      }
    }

    if (!input.incluirActor && input.actorUserId) {
      destinatarios.delete(input.actorUserId);
    }

    const usuariosValidos = destinatarios.size
      ? await db.user.findMany({
          where: {
            id: { in: [...destinatarios] },
            activo: true,
            memberships: {
              some: { tenantId: input.tenantId, activa: true },
            },
          },
          select: { id: true },
        })
      : [];

    return db.eventoSistema.create({
      data: {
        tenantId: input.tenantId,
        tipo: input.tipo,
        entidadTipo: input.entidadTipo,
        entidadId: input.entidadId,
        actorUserId: input.actorUserId,
        actorNombre: input.actorNombre,
        titulo: input.titulo,
        mensaje: input.mensaje,
        href: input.href,
        severidad: input.severidad ?? SeveridadNotificacionInterna.INFO,
        topicos: [...new Set(input.topicos)],
        notificaciones: usuariosValidos.length
          ? {
              create: usuariosValidos.map(({ id }) => ({
                tenantId: input.tenantId,
                userId: id,
              })),
            }
          : undefined,
      },
    });
  }

  async publicarDesdeAuth(
    auth: CurrentAuth,
    input: Omit<
      PublicarEventoSistema,
      'tenantId' | 'actorUserId' | 'actorNombre'
    >,
    db: Db = this.prisma,
  ) {
    return this.publicar(
      {
        ...input,
        tenantId: auth.tenantId,
        actorUserId: auth.impersonacion?.actorUserId ?? auth.userId,
        actorNombre: firmaActor(auth, auth.email),
      },
      db,
    );
  }

  async listarNotificaciones(auth: CurrentAuth, limiteRaw?: string) {
    const numero = Number(limiteRaw ?? 30);
    const limite = Number.isFinite(numero)
      ? Math.max(1, Math.min(100, Math.trunc(numero)))
      : 30;
    const filas = await this.prisma.notificacionInterna.findMany({
      where: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        archivadaEl: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limite,
      include: { evento: true },
    });
    return filas.map((fila) => ({
      id: fila.id,
      leidaEl: fila.leidaEl?.toISOString() ?? null,
      createdAt: fila.createdAt.toISOString(),
      evento: {
        id: fila.evento.id.toString(),
        tipo: fila.evento.tipo,
        actorNombre: fila.evento.actorNombre,
        titulo: fila.evento.titulo,
        mensaje: fila.evento.mensaje,
        href: fila.evento.href,
        severidad: fila.evento.severidad,
        createdAt: fila.evento.createdAt.toISOString(),
      },
    }));
  }

  async contarNoLeidas(auth: CurrentAuth) {
    const cantidad = await this.prisma.notificacionInterna.count({
      where: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        archivadaEl: null,
        leidaEl: null,
      },
    });
    return { cantidad };
  }

  async marcarLeida(auth: CurrentAuth, id: string) {
    const result = await this.prisma.notificacionInterna.updateMany({
      where: { id, tenantId: auth.tenantId, userId: auth.userId },
      data: { leidaEl: new Date() },
    });
    if (!result.count)
      throw new NotFoundException('Notificación no encontrada.');
    return { ok: true };
  }

  async marcarTodasLeidas(auth: CurrentAuth) {
    const result = await this.prisma.notificacionInterna.updateMany({
      where: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        archivadaEl: null,
        leidaEl: null,
      },
      data: { leidaEl: new Date() },
    });
    return { actualizadas: result.count };
  }

  async cambiosDesde(auth: CurrentAuth, desde?: string) {
    const cursor = this.cursorValido(desde);
    if (cursor === null) {
      const ultimo = await this.prisma.eventoSistema.findFirst({
        where: { tenantId: auth.tenantId },
        orderBy: { id: 'desc' },
        select: { id: true },
      });
      return { cursor: (ultimo?.id ?? 0n).toString(), cambios: [] };
    }
    const eventos = await this.prisma.eventoSistema.findMany({
      where: { tenantId: auth.tenantId, id: { gt: cursor } },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, tipo: true, topicos: true, createdAt: true },
    });
    return {
      cursor: (eventos.at(-1)?.id ?? cursor).toString(),
      cambios: eventos.map((evento) => ({
        eventoId: evento.id.toString(),
        tipo: evento.tipo,
        topicos: evento.topicos,
        createdAt: evento.createdAt.toISOString(),
      })),
    };
  }

  stream(auth: CurrentAuth, lastEventId?: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let cerrado = false;
      let consultando = false;
      let cursor: bigint | null = this.cursorValido(lastEventId);

      const emitirPendientes = async () => {
        if (cerrado || consultando) return;
        consultando = true;
        try {
          if (cursor === null) {
            const ultimo = await this.prisma.eventoSistema.findFirst({
              where: { tenantId: auth.tenantId },
              orderBy: { id: 'desc' },
              select: { id: true },
            });
            cursor = ultimo?.id ?? 0n;
            const { cantidad } = await this.contarNoLeidas(auth);
            subscriber.next({
              type: 'ready',
              data: { noLeidas: cantidad, ultimoId: cursor.toString() },
              retry: 3000,
            });
            return;
          }

          const eventos = await this.prisma.eventoSistema.findMany({
            where: { tenantId: auth.tenantId, id: { gt: cursor } },
            orderBy: { id: 'asc' },
            take: 100,
            select: { id: true, tipo: true, topicos: true, createdAt: true },
          });
          for (const evento of eventos) {
            cursor = evento.id;
            subscriber.next({
              id: evento.id.toString(),
              type: 'cambio',
              data: {
                eventoId: evento.id.toString(),
                tipo: evento.tipo,
                topicos: evento.topicos,
                createdAt: evento.createdAt.toISOString(),
              },
              retry: 3000,
            });
          }
        } catch (error) {
          subscriber.error(error);
        } finally {
          consultando = false;
        }
      };

      void emitirPendientes();
      const polling = setInterval(() => void emitirPendientes(), 1500);
      const heartbeat = setInterval(
        () =>
          subscriber.next({ type: 'heartbeat', data: { ahora: Date.now() } }),
        15000,
      );
      return () => {
        cerrado = true;
        clearInterval(polling);
        clearInterval(heartbeat);
      };
    });
  }

  private cursorValido(value?: string) {
    if (!value || !/^\d+$/.test(value)) return null;
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
}
