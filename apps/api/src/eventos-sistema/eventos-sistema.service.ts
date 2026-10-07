import {
  ForbiddenException,
  Injectable,
  MessageEvent,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Prisma, SeveridadNotificacionInterna } from '@prisma/client';
import { Observable, ReplaySubject, takeUntil } from 'rxjs';
import type { CurrentAuth } from '../auth/auth.types';
import { firmaActor } from '../common/firma-actor';
import { PrismaService } from '../prisma/prisma.service';
import type { RevalidarAcceso } from '../auth/revalidacion-acceso';

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
  /** Audiencia resuelta en servidor: sólo usuarios y membresías activos. */
  todosLosUsuariosDelTenant?: boolean;
  proyectoCampanaId?: string;
  incluirActor?: boolean;
};

@Injectable()
export class EventosSistemaService implements OnModuleDestroy {
  private readonly cierre = new ReplaySubject<void>(1);
  constructor(private readonly prisma: PrismaService) {}

  onModuleDestroy() {
    this.cierre.next();
    this.cierre.complete();
  }

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

    const usuariosValidos =
      input.todosLosUsuariosDelTenant || destinatarios.size
        ? await db.user.findMany({
            where: {
              ...(input.todosLosUsuariosDelTenant
                ? !input.incluirActor && input.actorUserId
                  ? { id: { not: input.actorUserId } }
                  : {}
                : { id: { in: [...destinatarios] } }),
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
        evento: { tenantId: auth.tenantId },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limite,
      include: {
        evento: {
          include: {
            lecturas: {
              where: { tenantId: auth.tenantId },
              orderBy: [{ leidaEl: 'asc' }, { id: 'asc' }],
              select: { id: true, lectorNombre: true, leidaEl: true },
            },
          },
        },
      },
    });
    return filas.map((fila) => ({
      id: fila.id,
      leidaEl: fila.leidaEl?.toISOString() ?? null,
      createdAt: fila.createdAt.toISOString(),
      lecturas: fila.evento.lecturas.map((lectura) => ({
        id: lectura.id,
        nombre: lectura.lectorNombre,
        leidaEl: lectura.leidaEl.toISOString(),
      })),
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
        evento: { tenantId: auth.tenantId },
        leidaEl: null,
      },
    });
    return { cantidad };
  }

  async marcarLeida(auth: CurrentAuth, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const where = {
        id,
        tenantId: auth.tenantId,
        userId: auth.userId,
        archivadaEl: null,
        evento: { tenantId: auth.tenantId },
      };
      const existente = await tx.notificacionInterna.findFirst({
        where,
        select: { id: true },
      });
      if (!existente)
        throw new NotFoundException('Notificación no encontrada.');
      const leidaEl = new Date();
      const nuevas = await tx.notificacionInterna.updateManyAndReturn({
        where: { ...where, leidaEl: null },
        data: { leidaEl },
        select: { id: true, eventoId: true },
      });
      await this.registrarLecturas(tx, auth, nuevas, leidaEl);
      return { ok: true };
    });
  }

  async marcarTodasLeidas(auth: CurrentAuth) {
    return this.prisma.$transaction(async (tx) => {
      const leidaEl = new Date();
      const nuevas = await tx.notificacionInterna.updateManyAndReturn({
        where: {
          tenantId: auth.tenantId,
          userId: auth.userId,
          archivadaEl: null,
          leidaEl: null,
          evento: { tenantId: auth.tenantId },
        },
        data: { leidaEl },
        select: { id: true, eventoId: true },
      });
      await this.registrarLecturas(tx, auth, nuevas, leidaEl);
      return { actualizadas: nuevas.length };
    });
  }

  private async registrarLecturas(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    nuevas: Array<{ id: string; eventoId: bigint }>,
    leidaEl: Date,
  ) {
    if (!nuevas.length) return;
    const lectorUserId = auth.impersonacion?.actorUserId ?? auth.userId;
    const user = await tx.user.findUnique({
      where: { id: lectorUserId },
      select: { nombreCompleto: true, email: true },
    });
    const nombre = firmaActor(
      auth,
      user?.nombreCompleto?.trim() || user?.email || auth.email,
    );
    const lectorNombre = (
      auth.mcp ? `${nombre} · Asistente: ${auth.mcp.credencialNombre}` : nombre
    ).slice(0, 200);
    await tx.eventoSistemaLectura.createMany({
      data: nuevas.map((fila) => ({
        tenantId: auth.tenantId,
        eventoId: fila.eventoId,
        notificacionId: fila.id,
        lectorUserId,
        lectorNombre,
        leidaEl,
      })),
    });
    // Invalida las bandejas del equipo por el canal existente. No genera otro
    // aviso ni publica nombres/identificadores de lectores en el stream general.
    await this.publicar(
      {
        tenantId: auth.tenantId,
        actorUserId: lectorUserId,
        actorNombre: lectorNombre,
        tipo: 'notificaciones.lectura_registrada',
        entidadTipo: 'notificacion',
        titulo: 'Lectura registrada',
        mensaje: 'Se actualizó el registro de lectura.',
        topicos: ['notificaciones'],
      },
      tx,
    );
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

  stream(
    auth: CurrentAuth,
    revalidar: RevalidarAcceso,
    lastEventId?: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let cerrado = false;
      let consultando = false;
      let inicializado = false;
      let cursor: bigint | null = this.cursorValido(lastEventId);
      let ultimoLatido = Date.now();
      const permisosIniciales = [...(auth.permisos ?? [])].sort().join('|');
      const validar = async () => {
        const actual = await revalidar();
        if (
          actual.sessionId !== auth.sessionId ||
          actual.userId !== auth.userId ||
          actual.tenantId !== auth.tenantId ||
          actual.membershipId !== auth.membershipId ||
          actual.role !== auth.role ||
          !actual.permisos?.has('panel.ver') ||
          [...actual.permisos].sort().join('|') !== permisosIniciales
        )
          throw new ForbiddenException();
      };

      const emitirPendientes = async () => {
        if (cerrado || consultando) return;
        consultando = true;
        try {
          await validar();
          if (cerrado || subscriber.closed) return;
          if (!inicializado) {
            const esConexionNueva = cursor === null;
            if (cursor === null) {
              const ultimo = await this.prisma.eventoSistema.findFirst({
                where: { tenantId: auth.tenantId },
                orderBy: { id: 'desc' },
                select: { id: true },
              });
              cursor = ultimo?.id ?? 0n;
            }
            const { cantidad } = await this.contarNoLeidas(auth);
            // La revocación puede ocurrir mientras se lee la base. Volver a
            // autorizar antes de entregar los datos, no sólo al abrir el SSE.
            await validar();
            if (cerrado || subscriber.closed) return;
            inicializado = true;
            subscriber.next({
              id: cursor.toString(),
              type: 'ready',
              data: { noLeidas: cantidad, ultimoId: cursor.toString() },
              retry: 3000,
            });
            // Al reconectar, confirma el canal y recupera lo ocurrido desde
            // el último evento recibido; no salta al final del historial.
            if (esConexionNueva) return;
          }

          if (cursor === null) return;
          const eventos = await this.prisma.eventoSistema.findMany({
            where: { tenantId: auth.tenantId, id: { gt: cursor } },
            orderBy: { id: 'asc' },
            take: 100,
            select: { id: true, tipo: true, topicos: true, createdAt: true },
          });
          if (eventos.length || Date.now() - ultimoLatido >= 15000)
            await validar();
          if (cerrado || subscriber.closed) return;
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
          if (Date.now() - ultimoLatido >= 15000) {
            ultimoLatido = Date.now();
            subscriber.next({
              id: cursor.toString(),
              type: 'heartbeat',
              data: { ahora: Date.now() },
            });
          }
        } catch {
          // Un rechazo o una base no disponible cierran sin entregar datos ni
          // detalles internos. La reconexión vuelve a atravesar los guards.
          subscriber.complete();
        } finally {
          consultando = false;
        }
      };

      void emitirPendientes();
      const polling = setInterval(() => void emitirPendientes(), 1500);
      const vencimiento = setTimeout(() => subscriber.complete(), 5 * 60_000);
      return () => {
        cerrado = true;
        clearInterval(polling);
        clearTimeout(vencimiento);
      };
    }).pipe(takeUntil(this.cierre));
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
