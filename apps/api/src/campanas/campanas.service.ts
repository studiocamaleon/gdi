import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ArchivoEstado, Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { firmaActor } from '../common/firma-actor';
import { paginatedResponse } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { EventosSistemaService } from '../eventos-sistema/eventos-sistema.service';
import {
  type CampanaEstado,
  type CampanaMiembroDto,
  CampanasOpcionesQueryDto,
  CampanasQueryDto,
  CambiarEstadoCampanaDto,
  CrearCampanaDto,
  CrearHitoDto,
  EditarCampanaDto,
  EditarHitoDto,
  ReemplazarEquipoDto,
} from './dto/campanas.dto';

const TRANSICIONES: Record<CampanaEstado, readonly CampanaEstado[]> = {
  borrador: ['activo', 'cancelado'],
  activo: ['pausado', 'completado', 'cancelado'],
  pausado: ['activo', 'completado', 'cancelado'],
  completado: ['activo'],
  cancelado: [],
};

export function transicionCampanaPermitida(
  desde: CampanaEstado,
  hacia: CampanaEstado,
) {
  return desde === hacia || TRANSICIONES[desde].includes(hacia);
}

const CAMPANA_INCLUDE = {
  cliente: { select: { id: true, nombre: true } },
  responsable: { select: { id: true, nombreCompleto: true } },
  equipo: {
    include: { empleado: { select: { id: true, nombreCompleto: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  hitos: {
    include: {
      responsable: { select: { id: true, nombreCompleto: true } },
    },
    orderBy: [{ orden: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  cotizaciones: {
    select: {
      id: true,
      numero: true,
      estado: true,
      total: true,
      fechaEmision: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
  ordenes: {
    select: {
      id: true,
      numero: true,
      estado: true,
      total: true,
      facturadoTotal: true,
      cobradoTotal: true,
      progresoPct: true,
      fechaEntrega: true,
      createdAt: true,
      items: {
        select: {
          cotizacionItem: { select: { costoTotal: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  eventos: {
    orderBy: { fecha: 'desc' as const },
    take: 100,
  },
  archivos: {
    where: { estado: ArchivoEstado.LISTO },
    include: {
      subidoPor: { select: { nombreCompleto: true, email: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.ProyectoCampanaInclude;

type CampanaCompleta = Prisma.ProyectoCampanaGetPayload<{
  include: typeof CAMPANA_INCLUDE;
}>;

@Injectable()
export class CampanasService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventosSistema?: EventosSistemaService,
  ) {}

  async listar(auth: CurrentAuth, query: CampanasQueryDto) {
    const texto = query.q?.trim();
    const where: Prisma.ProyectoCampanaWhereInput = {
      tenantId: auth.tenantId,
      ...(query.clienteId ? { clienteId: query.clienteId } : {}),
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.prioridad ? { prioridad: query.prioridad } : {}),
      ...(query.responsableEmpleadoId
        ? { responsableEmpleadoId: query.responsableEmpleadoId }
        : {}),
      ...(query.fechaDesde || query.fechaHasta
        ? {
            fechaObjetivo: {
              ...(query.fechaDesde
                ? { gte: this.fecha(query.fechaDesde) }
                : {}),
              ...(query.fechaHasta
                ? { lte: this.fecha(query.fechaHasta) }
                : {}),
            },
          }
        : {}),
      ...(texto
        ? {
            OR: [
              { codigo: { contains: texto, mode: 'insensitive' } },
              { nombre: { contains: texto, mode: 'insensitive' } },
              { tipo: { contains: texto, mode: 'insensitive' } },
              { cliente: { nombre: { contains: texto, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const hoy = this.inicioHoy();
    const enSieteDias = new Date(hoy);
    enSieteDias.setUTCDate(enSieteDias.getUTCDate() + 7);
    const [rows, total, porEstado, enRiesgo, proximas] =
      await this.prisma.$transaction([
        this.prisma.proyectoCampana.findMany({
          where,
          include: {
            cliente: { select: { id: true, nombre: true } },
            responsable: { select: { id: true, nombreCompleto: true } },
            _count: {
              select: { cotizaciones: true, ordenes: true, hitos: true },
            },
            hitos: { select: { estado: true, fechaObjetivo: true } },
            ordenes: { select: { estado: true, progresoPct: true } },
          },
          orderBy: [{ fechaObjetivo: 'asc' }, { createdAt: 'desc' }],
          skip: query.skip,
          take: query.limit,
        }),
        this.prisma.proyectoCampana.count({ where }),
        this.prisma.proyectoCampana.groupBy({
          by: ['estado'],
          where: { tenantId: auth.tenantId },
          orderBy: { estado: 'asc' },
          _count: { _all: true },
        }),
        this.prisma.proyectoCampana.count({
          where: {
            tenantId: auth.tenantId,
            estado: { in: ['activo', 'pausado'] },
            OR: [
              { fechaObjetivo: { lt: hoy } },
              {
                hitos: {
                  some: {
                    estado: { in: ['pendiente', 'en_curso'] },
                    fechaObjetivo: { lt: hoy },
                  },
                },
              },
            ],
          },
        }),
        this.prisma.proyectoCampana.count({
          where: {
            tenantId: auth.tenantId,
            estado: { in: ['activo', 'pausado'] },
            fechaObjetivo: { gte: hoy, lte: enSieteDias },
          },
        }),
      ]);

    return {
      ...paginatedResponse(
        rows.map((row) => ({
          id: row.id,
          codigo: row.codigo,
          nombre: row.nombre,
          tipo: row.tipo,
          estado: row.estado,
          prioridad: row.prioridad,
          fechaInicio: this.isoFecha(row.fechaInicio),
          fechaObjetivo: this.isoFecha(row.fechaObjetivo),
          updatedAt: row.updatedAt.toISOString(),
          cliente: row.cliente,
          responsable: row.responsable
            ? { id: row.responsable.id, nombre: row.responsable.nombreCompleto }
            : null,
          avancePct: this.avance(row.ordenes),
          riesgo: this.enRiesgo(row, hoy),
          cantidad: row._count,
        })),
        total,
        query,
      ),
      stats: {
        porEstado: Object.fromEntries(
          porEstado.map((item) => [
            item.estado,
            typeof item._count === 'object' ? (item._count?._all ?? 0) : 0,
          ]),
        ),
        enRiesgo,
        proximasAVencer: proximas,
      },
    };
  }

  async opciones(auth: CurrentAuth, query: CampanasOpcionesQueryDto) {
    const q = query.q?.trim();
    return this.prisma.proyectoCampana.findMany({
      where: {
        tenantId: auth.tenantId,
        estado: { not: 'cancelado' },
        ...(query.clienteId ? { clienteId: query.clienteId } : {}),
        ...(q
          ? {
              OR: [
                { codigo: { contains: q, mode: 'insensitive' } },
                { nombre: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        estado: true,
        clienteId: true,
      },
      orderBy: [{ estado: 'asc' }, { nombre: 'asc' }],
      take: 100,
    });
  }

  async crear(auth: CurrentAuth, dto: CrearCampanaDto) {
    await this.validarReferencias(auth, {
      clienteId: dto.clienteId,
      responsableEmpleadoId: dto.responsableEmpleadoId,
      equipo: dto.equipo,
      hitos: dto.hitos,
    });
    this.validarFechas(dto.fechaInicio, dto.fechaObjetivo);
    const actorNombre = await this.actorNombre(auth);
    const ahora = new Date();

    const creada = await this.prisma.$transaction(async (tx) => {
      const anio = ahora.getFullYear();
      const contador = await tx.proyectoCampanaContador.upsert({
        where: { tenantId_anio: { tenantId: auth.tenantId, anio } },
        create: { tenantId: auth.tenantId, anio, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      });
      const codigo = `CAM-${anio}-${String(contador.ultimo).padStart(4, '0')}`;
      const campana = await tx.proyectoCampana.create({
        data: {
          tenantId: auth.tenantId,
          clienteId: dto.clienteId,
          codigo,
          nombre: dto.nombre.trim(),
          descripcion: this.texto(dto.descripcion),
          tipo: this.texto(dto.tipo),
          prioridad: dto.prioridad ?? 'normal',
          fechaInicio: this.fechaNullable(dto.fechaInicio),
          fechaObjetivo: this.fechaNullable(dto.fechaObjetivo),
          responsableEmpleadoId: dto.responsableEmpleadoId ?? null,
          observaciones: this.texto(dto.observaciones),
          equipo: {
            create: (dto.equipo ?? []).map((m) => ({
              tenantId: auth.tenantId,
              empleadoId: m.empleadoId,
              funcion: this.texto(m.funcion),
            })),
          },
          hitos: {
            create: (dto.hitos ?? []).map((h, index) => ({
              tenantId: auth.tenantId,
              titulo: h.titulo.trim(),
              descripcion: this.texto(h.descripcion),
              responsableEmpleadoId: h.responsableEmpleadoId ?? null,
              fechaObjetivo: this.fechaNullable(h.fechaObjetivo),
              estado: h.estado ?? 'pendiente',
              notas: this.texto(h.notas),
              orden: h.orden ?? index,
              completadoEl: h.estado === 'completado' ? ahora : null,
            })),
          },
          eventos: {
            create: this.evento(
              auth,
              actorNombre,
              'creada',
              `Se creó ${codigo}.`,
              {
                clienteId: dto.clienteId,
              },
            ),
          },
        },
        select: { id: true },
      });
      await this.notificar(
        tx,
        auth,
        actorNombre,
        campana.id,
        'campana.creada',
        'Nueva campaña',
        `Se creó ${codigo}.`,
      );
      return campana;
    });
    return this.detalle(auth, creada.id);
  }

  async detalle(auth: CurrentAuth, id: string) {
    const campana = await this.prisma.proyectoCampana.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: CAMPANA_INCLUDE,
    });
    if (!campana) throw new NotFoundException('La campaña no existe.');
    return this.toDetalle(campana);
  }

  async editar(auth: CurrentAuth, id: string, dto: EditarCampanaDto) {
    const actual = await this.buscar(auth, id);
    const responsable =
      dto.responsableEmpleadoId === undefined
        ? actual.responsableEmpleadoId
        : dto.responsableEmpleadoId;
    await this.validarReferencias(auth, {
      clienteId: actual.clienteId,
      responsableEmpleadoId: responsable ?? undefined,
    });
    const inicio =
      dto.fechaInicio === undefined ? actual.fechaInicio : dto.fechaInicio;
    const objetivo =
      dto.fechaObjetivo === undefined
        ? actual.fechaObjetivo
        : dto.fechaObjetivo;
    this.validarFechas(inicio, objetivo);
    const data: Prisma.ProyectoCampanaUncheckedUpdateManyInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre.trim();
    if (dto.descripcion !== undefined)
      data.descripcion = this.texto(dto.descripcion);
    if (dto.tipo !== undefined) data.tipo = this.texto(dto.tipo);
    if (dto.prioridad !== undefined) data.prioridad = dto.prioridad;
    if (dto.fechaInicio !== undefined)
      data.fechaInicio = this.fechaNullable(dto.fechaInicio);
    if (dto.fechaObjetivo !== undefined)
      data.fechaObjetivo = this.fechaNullable(dto.fechaObjetivo);
    if (dto.responsableEmpleadoId !== undefined)
      data.responsableEmpleadoId = dto.responsableEmpleadoId;
    if (dto.observaciones !== undefined)
      data.observaciones = this.texto(dto.observaciones);
    const actorNombre = await this.actorNombre(auth);
    await this.prisma.$transaction(async (tx) => {
      const resultado = await tx.proyectoCampana.updateMany({
        where: {
          id,
          tenantId: auth.tenantId,
          updatedAt: new Date(dto.updatedAt),
        },
        data,
      });
      if (resultado.count !== 1) throw this.conflictoVersion();
      await tx.proyectoCampanaEvento.create({
        data: this.evento(
          auth,
          actorNombre,
          'editada',
          'Se actualizaron los datos de la campaña.',
          {
            campos: Object.keys(data),
          },
          id,
        ),
      });
      await this.notificar(
        tx,
        auth,
        actorNombre,
        id,
        'campana.editada',
        'Campaña actualizada',
        'Se actualizaron los datos de la campaña.',
      );
    });
    return this.detalle(auth, id);
  }

  async cambiarEstado(
    auth: CurrentAuth,
    id: string,
    dto: CambiarEstadoCampanaDto,
  ) {
    const actual = await this.buscar(auth, id);
    if (actual.estado === dto.estado) return this.detalle(auth, id);
    if (
      !transicionCampanaPermitida(actual.estado as CampanaEstado, dto.estado)
    ) {
      throw new BadRequestException(
        `No se puede pasar una campaña de ${actual.estado} a ${dto.estado}.`,
      );
    }
    const actorNombre = await this.actorNombre(auth);
    await this.prisma.$transaction(async (tx) => {
      const cambio = await tx.proyectoCampana.updateMany({
        where: {
          id,
          tenantId: auth.tenantId,
          updatedAt: new Date(dto.updatedAt),
        },
        data: {
          estado: dto.estado,
          fechaCompletada: dto.estado === 'completado' ? new Date() : null,
        },
      });
      if (cambio.count !== 1) throw this.conflictoVersion();
      await tx.proyectoCampanaEvento.create({
        data: this.evento(
          auth,
          actorNombre,
          'estado',
          `Estado cambiado de ${actual.estado} a ${dto.estado}.`,
          { antes: actual.estado, despues: dto.estado },
          id,
        ),
      });
      await this.notificar(
        tx,
        auth,
        actorNombre,
        id,
        'campana.estado',
        'Estado de campaña',
        `La campaña pasó de ${actual.estado} a ${dto.estado}.`,
      );
    });
    return this.detalle(auth, id);
  }

  async crearHito(auth: CurrentAuth, campanaId: string, dto: CrearHitoDto) {
    await this.buscar(auth, campanaId);
    await this.validarReferencias(auth, {
      responsableEmpleadoId: dto.responsableEmpleadoId,
    });
    const actorNombre = await this.actorNombre(auth);
    await this.prisma.$transaction(async (tx) => {
      await tx.proyectoCampanaHito.create({
        data: {
          tenantId: auth.tenantId,
          proyectoCampanaId: campanaId,
          titulo: dto.titulo.trim(),
          descripcion: this.texto(dto.descripcion),
          responsableEmpleadoId: dto.responsableEmpleadoId ?? null,
          fechaObjetivo: this.fechaNullable(dto.fechaObjetivo),
          estado: dto.estado ?? 'pendiente',
          notas: this.texto(dto.notas),
          orden: dto.orden ?? 0,
          completadoEl: dto.estado === 'completado' ? new Date() : null,
        },
      });
      await tx.proyectoCampanaEvento.create({
        data: this.evento(
          auth,
          actorNombre,
          'hito_creado',
          `Se agregó el hito “${dto.titulo.trim()}”.`,
          undefined,
          campanaId,
        ),
      });
      await this.notificar(
        tx,
        auth,
        actorNombre,
        campanaId,
        'campana.hito_creado',
        'Nuevo hito',
        `Se agregó el hito “${dto.titulo.trim()}”.`,
      );
    });
    return this.detalle(auth, campanaId);
  }

  async editarHito(
    auth: CurrentAuth,
    campanaId: string,
    hitoId: string,
    dto: EditarHitoDto,
  ) {
    await this.buscar(auth, campanaId);
    const actual = await this.prisma.proyectoCampanaHito.findFirst({
      where: {
        id: hitoId,
        proyectoCampanaId: campanaId,
        tenantId: auth.tenantId,
      },
    });
    if (!actual) throw new NotFoundException('El hito no existe.');
    await this.validarReferencias(auth, {
      responsableEmpleadoId:
        dto.responsableEmpleadoId === undefined
          ? (actual.responsableEmpleadoId ?? undefined)
          : (dto.responsableEmpleadoId ?? undefined),
    });
    const data: Prisma.ProyectoCampanaHitoUncheckedUpdateManyInput = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo.trim();
    if (dto.descripcion !== undefined)
      data.descripcion = this.texto(dto.descripcion);
    if (dto.responsableEmpleadoId !== undefined)
      data.responsableEmpleadoId = dto.responsableEmpleadoId;
    if (dto.fechaObjetivo !== undefined)
      data.fechaObjetivo = this.fechaNullable(dto.fechaObjetivo);
    if (dto.notas !== undefined) data.notas = this.texto(dto.notas);
    if (dto.orden !== undefined) data.orden = dto.orden;
    if (dto.estado !== undefined) {
      data.estado = dto.estado;
      data.completadoEl = dto.estado === 'completado' ? new Date() : null;
    }
    const actorNombre = await this.actorNombre(auth);
    await this.prisma.$transaction(async (tx) => {
      const cambio = await tx.proyectoCampanaHito.updateMany({
        where: {
          id: hitoId,
          proyectoCampanaId: campanaId,
          tenantId: auth.tenantId,
          updatedAt: new Date(dto.updatedAt),
        },
        data,
      });
      if (cambio.count !== 1) throw this.conflictoVersion('hito');
      await tx.proyectoCampanaEvento.create({
        data: this.evento(
          auth,
          actorNombre,
          'hito_editado',
          `Se actualizó el hito “${actual.titulo}”.`,
          {
            campos: Object.keys(data),
          },
          campanaId,
        ),
      });
      await this.notificar(
        tx,
        auth,
        actorNombre,
        campanaId,
        'campana.hito_editado',
        'Hito actualizado',
        `Se actualizó el hito “${actual.titulo}”.`,
      );
    });
    return this.detalle(auth, campanaId);
  }

  async reemplazarEquipo(
    auth: CurrentAuth,
    campanaId: string,
    dto: ReemplazarEquipoDto,
  ) {
    await this.buscar(auth, campanaId);
    await this.validarReferencias(auth, { equipo: dto.equipo });
    const actorNombre = await this.actorNombre(auth);
    await this.prisma.$transaction(async (tx) => {
      await tx.proyectoCampanaMiembro.deleteMany({
        where: { proyectoCampanaId: campanaId, tenantId: auth.tenantId },
      });
      if (dto.equipo.length) {
        await tx.proyectoCampanaMiembro.createMany({
          data: dto.equipo.map((m) => ({
            tenantId: auth.tenantId,
            proyectoCampanaId: campanaId,
            empleadoId: m.empleadoId,
            funcion: this.texto(m.funcion),
          })),
        });
      }
      await tx.proyectoCampanaEvento.create({
        data: this.evento(
          auth,
          actorNombre,
          'equipo',
          'Se actualizó el equipo de la campaña.',
          {
            empleados: dto.equipo.map((m) => m.empleadoId),
          },
          campanaId,
        ),
      });
      await this.notificar(
        tx,
        auth,
        actorNombre,
        campanaId,
        'campana.equipo',
        'Equipo actualizado',
        'Se actualizó el equipo de la campaña.',
      );
    });
    return this.detalle(auth, campanaId);
  }

  vincularCotizacion(
    auth: CurrentAuth,
    campanaId: string,
    cotizacionId: string,
  ) {
    return this.vincular(auth, campanaId, 'cotizacion', cotizacionId, true);
  }

  desvincularCotizacion(
    auth: CurrentAuth,
    campanaId: string,
    cotizacionId: string,
  ) {
    return this.vincular(auth, campanaId, 'cotizacion', cotizacionId, false);
  }

  vincularOrden(auth: CurrentAuth, campanaId: string, ordenId: string) {
    return this.vincular(auth, campanaId, 'orden', ordenId, true);
  }

  desvincularOrden(auth: CurrentAuth, campanaId: string, ordenId: string) {
    return this.vincular(auth, campanaId, 'orden', ordenId, false);
  }

  private async vincular(
    auth: CurrentAuth,
    campanaId: string,
    tipo: 'cotizacion' | 'orden',
    documentoId: string,
    agregar: boolean,
  ) {
    const campana = await this.buscar(auth, campanaId);
    const documento =
      tipo === 'cotizacion'
        ? await this.prisma.cotizacion.findFirst({
            where: { id: documentoId, tenantId: auth.tenantId },
            select: {
              id: true,
              numero: true,
              clienteId: true,
              proyectoCampanaId: true,
            },
          })
        : await this.prisma.ordenTrabajo.findFirst({
            where: { id: documentoId, tenantId: auth.tenantId },
            select: {
              id: true,
              numero: true,
              clienteId: true,
              proyectoCampanaId: true,
            },
          });
    if (!documento) throw new NotFoundException(`La ${tipo} no existe.`);
    if (agregar && documento.clienteId !== campana.clienteId) {
      throw new BadRequestException(
        'La campaña y el documento deben pertenecer al mismo cliente.',
      );
    }
    if (
      agregar &&
      documento.proyectoCampanaId &&
      documento.proyectoCampanaId !== campanaId
    ) {
      throw new ConflictException(
        'El documento ya pertenece a otra campaña. Desvinculalo allí antes de moverlo.',
      );
    }
    if (!agregar && documento.proyectoCampanaId !== campanaId) {
      throw new BadRequestException(
        'El documento no está vinculado a esta campaña.',
      );
    }
    const actorNombre = await this.actorNombre(auth);
    await this.prisma.$transaction(async (tx) => {
      if (tipo === 'cotizacion') {
        await tx.cotizacion.updateMany({
          where: { id: documentoId, tenantId: auth.tenantId },
          data: { proyectoCampanaId: agregar ? campanaId : null },
        });
      } else {
        await tx.ordenTrabajo.updateMany({
          where: { id: documentoId, tenantId: auth.tenantId },
          data: { proyectoCampanaId: agregar ? campanaId : null },
        });
      }
      await tx.proyectoCampanaEvento.create({
        data: this.evento(
          auth,
          actorNombre,
          agregar ? 'vinculo' : 'desvinculo',
          `${agregar ? 'Se vinculó' : 'Se desvinculó'} ${documento.numero ?? tipo}.`,
          { tipo, documentoId, anteriorCampanaId: documento.proyectoCampanaId },
          campanaId,
        ),
      });
      await this.notificar(
        tx,
        auth,
        actorNombre,
        campanaId,
        agregar ? 'campana.vinculo' : 'campana.desvinculo',
        agregar ? 'Documento vinculado' : 'Documento desvinculado',
        `${agregar ? 'Se vinculó' : 'Se desvinculó'} ${documento.numero ?? tipo}.`,
        tipo === 'orden' ? [`orden:${documentoId}`, 'tablero-produccion'] : [],
      );
    });
    return this.detalle(auth, campanaId);
  }

  private async buscar(auth: CurrentAuth, id: string) {
    const campana = await this.prisma.proyectoCampana.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!campana) throw new NotFoundException('La campaña no existe.');
    return campana;
  }

  private notificar(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    actorNombre: string,
    campanaId: string,
    tipo: string,
    titulo: string,
    mensaje: string,
    topicosExtra: string[] = [],
  ) {
    if (!this.eventosSistema) return Promise.resolve();
    return this.eventosSistema.publicar(
      {
        tenantId: auth.tenantId,
        actorUserId: auth.impersonacion?.actorUserId ?? auth.userId,
        actorNombre,
        tipo,
        entidadTipo: 'campana',
        entidadId: campanaId,
        titulo,
        mensaje,
        href: `/comercial/campanas/${campanaId}`,
        topicos: [`campana:${campanaId}`, ...topicosExtra],
        proyectoCampanaId: campanaId,
      },
      tx,
    );
  }

  private async validarReferencias(
    auth: CurrentAuth,
    refs: {
      clienteId?: string;
      responsableEmpleadoId?: string;
      equipo?: CampanaMiembroDto[];
      hitos?: CrearHitoDto[];
    },
  ) {
    if (refs.clienteId) {
      const cliente = await this.prisma.cliente.findFirst({
        where: { id: refs.clienteId, tenantId: auth.tenantId, activo: true },
        select: { id: true },
      });
      if (!cliente)
        throw new BadRequestException(
          'El cliente no existe o está inhabilitado.',
        );
    }
    const ids = [
      refs.responsableEmpleadoId,
      ...(refs.equipo ?? []).map((m) => m.empleadoId),
      ...(refs.hitos ?? []).map((h) => h.responsableEmpleadoId),
    ].filter((id): id is string => Boolean(id));
    const unicos = [...new Set(ids)];
    if (
      refs.equipo &&
      new Set(refs.equipo.map((m) => m.empleadoId)).size !== refs.equipo.length
    ) {
      throw new BadRequestException(
        'No se puede repetir una persona en el equipo.',
      );
    }
    if (!unicos.length) return;
    const existentes = await this.prisma.empleado.count({
      where: { tenantId: auth.tenantId, activo: true, id: { in: unicos } },
    });
    if (existentes !== unicos.length) {
      throw new BadRequestException(
        'Una persona asignada no existe o está dada de baja.',
      );
    }
  }

  private toDetalle(c: CampanaCompleta) {
    const vendido = c.ordenes
      .filter((o) => o.estado !== 'cancelada')
      .reduce((s, o) => s + Number(o.total ?? 0), 0);
    const presupuestado = c.cotizaciones
      .filter((p) => !['rechazado', 'vencido'].includes(p.estado))
      .reduce((s, p) => s + Number(p.total ?? 0), 0);
    const facturado = c.ordenes.reduce(
      (s, o) => s + Number(o.facturadoTotal),
      0,
    );
    const cobrado = c.ordenes.reduce((s, o) => s + Number(o.cobradoTotal), 0);
    const itemsVendidos = c.ordenes
      .filter((o) => o.estado !== 'cancelada')
      .flatMap((o) => o.items);
    const itemsConCosto = itemsVendidos.filter(
      (item) => item.cotizacionItem?.costoTotal != null,
    );
    const costoEstimado = itemsConCosto.reduce(
      (s, item) => s + Number(item.cotizacionItem?.costoTotal ?? 0),
      0,
    );
    const margenEstimado = vendido - costoEstimado;
    const hoy = this.inicioHoy();
    return {
      id: c.id,
      codigo: c.codigo,
      nombre: c.nombre,
      descripcion: c.descripcion,
      tipo: c.tipo,
      estado: c.estado,
      prioridad: c.prioridad,
      fechaInicio: this.isoFecha(c.fechaInicio),
      fechaObjetivo: this.isoFecha(c.fechaObjetivo),
      fechaCompletada: this.isoFecha(c.fechaCompletada),
      observaciones: c.observaciones,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      cliente: c.cliente,
      responsable: c.responsable
        ? { id: c.responsable.id, nombre: c.responsable.nombreCompleto }
        : null,
      equipo: c.equipo.map((m) => ({
        id: m.id,
        empleadoId: m.empleadoId,
        nombre: m.empleado.nombreCompleto,
        funcion: m.funcion,
      })),
      hitos: c.hitos.map((h) => ({
        id: h.id,
        titulo: h.titulo,
        descripcion: h.descripcion,
        estado: h.estado,
        fechaObjetivo: this.isoFecha(h.fechaObjetivo),
        completadoEl: h.completadoEl?.toISOString() ?? null,
        notas: h.notas,
        orden: h.orden,
        updatedAt: h.updatedAt.toISOString(),
        responsable: h.responsable
          ? { id: h.responsable.id, nombre: h.responsable.nombreCompleto }
          : null,
      })),
      cotizaciones: c.cotizaciones.map((p) => ({
        ...p,
        total: Number(p.total ?? 0),
        fechaEmision: p.fechaEmision?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      ordenes: c.ordenes.map((o) => ({
        id: o.id,
        numero: o.numero,
        estado: o.estado,
        total: Number(o.total ?? 0),
        facturadoTotal: Number(o.facturadoTotal),
        cobradoTotal: Number(o.cobradoTotal),
        progresoPct: o.progresoPct,
        fechaEntrega: this.isoFecha(o.fechaEntrega),
        createdAt: o.createdAt.toISOString(),
      })),
      archivos: c.archivos.map((a) => ({
        id: a.id,
        nombre: a.nombreOriginal,
        mimeType: a.mimeType,
        bytes: Number(a.bytes),
        descripcion: a.descripcion,
        createdAt: a.createdAt.toISOString(),
        subidoPor: a.subidoPor?.nombreCompleto ?? a.subidoPor?.email ?? null,
      })),
      eventos: c.eventos.map((e) => ({
        id: e.id,
        fecha: e.fecha.toISOString(),
        tipo: e.tipo,
        descripcion: e.descripcion,
        actor: e.actorNombre,
        origen: e.origen,
        datos: e.datosJson,
      })),
      dashboard: {
        comercial: { presupuestado, vendido, facturado, cobrado },
        produccion: {
          avancePct: this.avance(c.ordenes),
          porEstado: this.contar(c.ordenes.map((o) => o.estado)),
          abiertas: c.ordenes.filter(
            (o) => !['entregada', 'cancelada'].includes(o.estado),
          ).length,
        },
        hitos: {
          porEstado: this.contar(c.hitos.map((h) => h.estado)),
          vencidos: c.hitos.filter(
            (h) =>
              !['completado', 'cancelado'].includes(h.estado) &&
              h.fechaObjetivo !== null &&
              h.fechaObjetivo < hoy,
          ).length,
        },
        entregas: {
          entregadas: c.ordenes.filter((o) => o.estado === 'entregada').length,
          vencidas: c.ordenes.filter(
            (o) =>
              !['entregada', 'cancelada'].includes(o.estado) &&
              o.fechaEntrega !== null &&
              o.fechaEntrega < hoy,
          ).length,
        },
        materiales: {
          disponible: false,
          mensaje:
            'La disponibilidad detallada se habilitará con demanda y reservas de materiales.',
        },
        rentabilidad: {
          disponible: itemsConCosto.length > 0,
          costoEstimado,
          margenEstimado,
          margenPct: vendido > 0 ? (margenEstimado / vendido) * 100 : null,
          parcial: itemsConCosto.length !== itemsVendidos.length,
          mensaje:
            itemsConCosto.length > 0
              ? 'Estimación basada en los snapshots de costo de los ítems vendidos; no reemplaza el costo real de ejecución.'
              : 'Aún no hay ítems vendidos con snapshot de costo.',
        },
      },
      senalesCierre: {
        ordenesAbiertas: c.ordenes.filter(
          (o) => !['entregada', 'cancelada'].includes(o.estado),
        ).length,
        hitosPendientes: c.hitos.filter(
          (h) => !['completado', 'cancelado'].includes(h.estado),
        ).length,
      },
    };
  }

  private evento(
    auth: CurrentAuth,
    actorNombre: string,
    tipo: string,
    descripcion: string,
    datos?: object,
  ): Prisma.ProyectoCampanaEventoUncheckedCreateWithoutCampanaInput;
  private evento(
    auth: CurrentAuth,
    actorNombre: string,
    tipo: string,
    descripcion: string,
    datos: object | undefined,
    proyectoCampanaId: string,
  ): Prisma.ProyectoCampanaEventoUncheckedCreateInput;
  private evento(
    auth: CurrentAuth,
    actorNombre: string,
    tipo: string,
    descripcion: string,
    datos?: object,
    proyectoCampanaId?: string,
  ):
    | Prisma.ProyectoCampanaEventoUncheckedCreateWithoutCampanaInput
    | Prisma.ProyectoCampanaEventoUncheckedCreateInput {
    return {
      tenantId: auth.tenantId,
      ...(proyectoCampanaId ? { proyectoCampanaId } : {}),
      tipo,
      descripcion,
      actorUserId: auth.impersonacion?.actorUserId ?? auth.userId,
      actorNombre,
      datosJson: datos as Prisma.InputJsonValue | undefined,
      origen: auth.impersonacion ? 'soporte' : auth.mcp ? 'api' : 'usuario',
    };
  }

  private async actorNombre(auth: CurrentAuth) {
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      select: { nombreCompleto: true, email: true },
    });
    return firmaActor(auth, user?.nombreCompleto ?? user?.email ?? auth.email);
  }

  private fecha(value: string | Date) {
    if (value instanceof Date) return value;
    return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  }

  private fechaNullable(value?: string | Date | null) {
    return value ? this.fecha(value) : null;
  }

  private isoFecha(value: Date | null) {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private validarFechas(
    inicio?: string | Date | null,
    objetivo?: string | Date | null,
  ) {
    if (inicio && objetivo && this.fecha(inicio) > this.fecha(objetivo)) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser posterior a la fecha objetivo.',
      );
    }
  }

  private texto(value?: string | null) {
    const limpio = value?.trim();
    return limpio ? limpio : null;
  }

  private inicioHoy() {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private avance(ordenes: Array<{ progresoPct: number | null }>) {
    const conDato = ordenes.filter((o) => o.progresoPct !== null);
    return conDato.length
      ? Math.round(
          conDato.reduce((s, o) => s + (o.progresoPct ?? 0), 0) /
            conDato.length,
        )
      : null;
  }

  private enRiesgo(
    row: {
      estado: string;
      fechaObjetivo: Date | null;
      hitos: Array<{ estado: string; fechaObjetivo: Date | null }>;
    },
    hoy: Date,
  ) {
    if (!['activo', 'pausado'].includes(row.estado)) return false;
    return (
      (row.fechaObjetivo !== null && row.fechaObjetivo < hoy) ||
      row.hitos.some(
        (h) =>
          !['completado', 'cancelado'].includes(h.estado) &&
          h.fechaObjetivo !== null &&
          h.fechaObjetivo < hoy,
      )
    );
  }

  private contar(valores: string[]) {
    return valores.reduce<Record<string, number>>((acc, valor) => {
      acc[valor] = (acc[valor] ?? 0) + 1;
      return acc;
    }, {});
  }

  private conflictoVersion(entidad = 'campaña') {
    return new ConflictException(
      `La ${entidad} cambió en otra pestaña. Recargá antes de volver a guardar.`,
    );
  }
}
