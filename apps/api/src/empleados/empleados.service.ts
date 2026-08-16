import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Empleado,
  EmpleadoComision,
  EmpleadoDireccion,
  EmpleadoEvento,
  Membership,
  Prisma,
  RolSistema,
  SexoEmpleado,
  TipoComision,
  TipoDireccion,
  User,
} from '@prisma/client';
import { CurrentAuth } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { paginatedResponse } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { EmpleadoComisionDto, TipoComisionDto } from './dto/comision.dto';
import { EmpleadoDireccionDto, TipoDireccionDto } from './dto/direccion.dto';
import { EmpleadosQueryDto } from './dto/empleados-query.dto';
import {
  SexoEmpleadoDto,
  UpdateEmpleadoDto,
  UpsertEmpleadoDto,
} from './dto/upsert-empleado.dto';

type EmpleadoCompleto = Empleado & {
  direcciones: EmpleadoDireccion[];
  comisiones: EmpleadoComision[];
  eventos: EmpleadoEvento[];
  user: (User & { memberships: Membership[] }) | null;
};

@Injectable()
export class EmpleadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll(auth: CurrentAuth, query: EmpleadosQueryDto) {
    const q = query.q?.trim();
    const where: Prisma.EmpleadoWhereInput = {
      tenantId: auth.tenantId,
      ...(query.incluirInactivos === 'true' ? {} : { activo: true }),
      ...(q
        ? {
            OR: [
              { nombreCompleto: { contains: q, mode: 'insensitive' } },
              { sector: { contains: q, mode: 'insensitive' } },
              { ocupacion: { contains: q, mode: 'insensitive' } },
              { emailPrincipal: { contains: q, mode: 'insensitive' } },
              {
                direcciones: {
                  some: { ciudad: { contains: q, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
    const [empleados, total] = await this.prisma.$transaction([
      this.prisma.empleado.findMany({
        where,
        select: {
          id: true,
          nombreCompleto: true,
          emailPrincipal: true,
          sector: true,
          ocupacion: true,
          activo: true,
          fechaBaja: true,
          motivoBaja: true,
          updatedAt: true,
          direcciones: {
            where: { principal: true },
            select: { ciudad: true },
            take: 1,
          },
          user: {
            select: {
              email: true,
              memberships: {
                where: { tenantId: auth.tenantId },
                select: { activa: true },
                take: 1,
              },
            },
          },
        },
        orderBy: [{ activo: 'desc' }, { nombreCompleto: 'asc' }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.empleado.count({ where }),
    ]);
    return paginatedResponse(
      empleados.map((empleado) => ({
        id: empleado.id,
        nombreCompleto: empleado.nombreCompleto,
        email: empleado.emailPrincipal,
        sector: empleado.sector,
        ocupacion: empleado.ocupacion ?? '',
        ciudad: empleado.direcciones[0]?.ciudad ?? '',
        activo: empleado.activo,
        fechaBaja: empleado.fechaBaja
          ? this.toDateInput(empleado.fechaBaja)
          : '',
        motivoBaja: empleado.motivoBaja ?? '',
        usuarioSistema: Boolean(
          empleado.user && empleado.user.memberships[0]?.activa,
        ),
        emailAcceso: empleado.user?.email ?? '',
        updatedAt: empleado.updatedAt.toISOString(),
      })),
      total,
      query,
    );
  }

  opciones(auth: CurrentAuth) {
    return this.prisma.empleado.findMany({
      where: { tenantId: auth.tenantId, activo: true },
      select: { id: true, nombreCompleto: true, sector: true, ocupacion: true },
      orderBy: { nombreCompleto: 'asc' },
    });
  }

  async findOne(auth: CurrentAuth, id: string) {
    const empleado = await this.findEmpleadoOrThrow(auth, id, this.prisma);
    return this.toResponse(empleado, this.puedeVerComisiones(auth));
  }

  async create(auth: CurrentAuth, payload: UpsertEmpleadoDto) {
    this.exigirPermisoComisionesSiCorresponde(auth, payload);
    const empleado = await this.createNormalized(
      this.prisma,
      auth,
      this.normalizePayload(payload),
    );
    return this.toResponse(empleado, this.puedeVerComisiones(auth));
  }

  async importar(auth: CurrentAuth, payloads: UpsertEmpleadoDto[]) {
    if (payloads.length === 0) return { data: [], total: 0 };
    payloads.forEach((payload) =>
      this.exigirPermisoComisionesSiCorresponde(auth, payload),
    );
    const normalized = payloads.map((payload) =>
      this.normalizePayload(payload),
    );
    const empleados = await this.prisma.$transaction(
      async (tx) => {
        const resultado: EmpleadoCompleto[] = [];
        for (const item of normalized) {
          resultado.push(await this.createNormalized(tx, auth, item));
        }
        return resultado;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return {
      data: empleados.map((empleado) =>
        this.toResponse(empleado, this.puedeVerComisiones(auth)),
      ),
      total: empleados.length,
    };
  }

  private createNormalized(
    db: PrismaService | Prisma.TransactionClient,
    auth: CurrentAuth,
    normalized: ReturnType<EmpleadosService['normalizePayload']>,
  ) {
    return db.empleado.create({
      data: {
        tenantId: auth.tenantId,
        nombreCompleto: normalized.nombreCompleto,
        emailPrincipal: normalized.email,
        telefonoCodigo: normalized.telefonoCodigo,
        telefonoNumero: normalized.telefonoNumero,
        sector: normalized.sector,
        ocupacion: normalized.ocupacion,
        sexo: normalized.sexo,
        fechaIngreso: normalized.fechaIngreso,
        fechaNacimiento: normalized.fechaNacimiento,
        comisionesHabilitadas: normalized.comisionesHabilitadas,
        direcciones: {
          create: normalized.direcciones.map((direccion) => ({
            ...(direccion.id ? { id: direccion.id } : {}),
            tenantId: auth.tenantId,
            descripcion: direccion.descripcion,
            paisCodigo: direccion.pais,
            codigoPostal: direccion.codigoPostal,
            direccion: direccion.direccion,
            numero: direccion.numero,
            ciudad: direccion.ciudad,
            tipo: this.toPrismaTipoDireccion(direccion.tipo),
            principal: direccion.principal,
          })),
        },
        comisiones: {
          create: normalized.comisiones.map((comision) => ({
            ...(comision.id ? { id: comision.id } : {}),
            tenantId: auth.tenantId,
            descripcion: comision.descripcion,
            tipo: this.toPrismaTipoComision(comision.tipo),
            valor: new Prisma.Decimal(comision.valor),
          })),
        },
        eventos: {
          create: {
            tenantId: auth.tenantId,
            tipo: 'creado',
            actorId: auth.userId,
            actorNombre: auth.email,
          },
        },
      },
      include: this.includeParaTenant(auth.tenantId),
    }) as Promise<EmpleadoCompleto>;
  }

  async update(auth: CurrentAuth, id: string, payload: UpdateEmpleadoDto) {
    const normalized = this.normalizePayload(payload);
    return this.prisma.$transaction(async (tx) => {
      const actual = await this.findEmpleadoOrThrow(auth, id, tx);
      const actualizado = await tx.empleado.updateMany({
        where: {
          id,
          tenantId: auth.tenantId,
          updatedAt: new Date(payload.updatedAt),
        },
        data: {
          nombreCompleto: normalized.nombreCompleto,
          emailPrincipal: normalized.email,
          telefonoCodigo: normalized.telefonoCodigo,
          telefonoNumero: normalized.telefonoNumero,
          sector: normalized.sector,
          ocupacion: normalized.ocupacion,
          sexo: normalized.sexo,
          fechaIngreso: normalized.fechaIngreso,
          fechaNacimiento: normalized.fechaNacimiento,
          ...(this.puedeVerComisiones(auth)
            ? { comisionesHabilitadas: normalized.comisionesHabilitadas }
            : {}),
        },
      });
      if (actualizado.count !== 1) {
        throw new ConflictException(
          'Este legajo fue modificado por otra persona. Recargá la ficha antes de volver a guardar.',
        );
      }
      await this.sincronizarDirecciones(
        tx,
        auth.tenantId,
        id,
        actual.direcciones,
        normalized.direcciones,
      );
      if (this.puedeVerComisiones(auth)) {
        await this.sincronizarComisiones(
          tx,
          auth.tenantId,
          id,
          actual.comisiones,
          normalized.comisionesHabilitadas ? normalized.comisiones : [],
        );
      }
      await tx.empleadoEvento.create({
        data: {
          tenantId: auth.tenantId,
          empleadoId: id,
          tipo: 'editado',
          actorId: auth.userId,
          actorNombre: auth.email,
        },
      });
      return this.toResponse(
        await this.findEmpleadoOrThrow(auth, id, tx),
        this.puedeVerComisiones(auth),
      );
    });
  }

  async fijarActivo(
    auth: CurrentAuth,
    id: string,
    activo: boolean,
    motivo?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.fijarActivoEnTransaccion(tx, auth, id, activo, motivo);
      return this.toResponse(
        await this.findEmpleadoOrThrow(auth, id, tx),
        this.puedeVerComisiones(auth),
      );
    });
  }

  async fijarEstadoMuchos(
    auth: CurrentAuth,
    ids: string[],
    activo: boolean,
    motivo?: string,
  ) {
    const unicos = [...new Set(ids)];
    return this.prisma.$transaction(
      async (tx) => {
        const encontrados = await tx.empleado.count({
          where: { tenantId: auth.tenantId, id: { in: unicos } },
        });
        if (encontrados !== unicos.length) {
          throw new BadRequestException(
            'Uno o más empleados no existen o pertenecen a otra empresa.',
          );
        }
        for (const id of unicos) {
          await this.fijarActivoEnTransaccion(tx, auth, id, activo, motivo);
        }
        return { total: unicos.length };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async remove(auth: CurrentAuth, id: string) {
    await this.fijarActivo(auth, id, false);
  }

  private async fijarActivoEnTransaccion(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    id: string,
    activo: boolean,
    motivo?: string,
  ) {
    const empleado = await tx.empleado.findFirst({
      where: { id, tenantId: auth.tenantId },
      select: { id: true, activo: true, userId: true },
    });
    if (!empleado) throw new NotFoundException(`No existe el empleado ${id}`);
    if (empleado.activo === activo) return;
    if (!activo && empleado.userId) {
      await this.authService.revokeEmployeeAccessInTransaction(
        tx,
        auth.tenantId,
        id,
        empleado.userId,
      );
    }
    await tx.empleado.update({
      where: { id },
      data: {
        activo,
        fechaBaja: activo ? null : new Date(),
        motivoBaja: activo ? null : motivo?.trim() || null,
      },
    });
    await tx.empleadoEvento.create({
      data: {
        tenantId: auth.tenantId,
        empleadoId: id,
        tipo: activo ? 'reactivado' : 'baja',
        actorId: auth.userId,
        actorNombre: auth.email,
        detalle: motivo?.trim() ? { motivo: motivo.trim() } : undefined,
      },
    });
  }

  private async sincronizarDirecciones(
    tx: Prisma.TransactionClient,
    tenantId: string,
    empleadoId: string,
    actuales: EmpleadoDireccion[],
    entrantes: ReturnType<EmpleadosService['normalizeDirecciones']>,
  ) {
    const idsActuales = new Set(actuales.map((item) => item.id));
    const idsConservar = entrantes
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id && idsActuales.has(id)));
    await tx.empleadoDireccion.deleteMany({
      where: {
        tenantId,
        empleadoId,
        ...(idsConservar.length > 0 ? { id: { notIn: idsConservar } } : {}),
      },
    });
    for (const direccion of entrantes) {
      const data = {
        descripcion: direccion.descripcion,
        paisCodigo: direccion.pais,
        codigoPostal: direccion.codigoPostal,
        direccion: direccion.direccion,
        numero: direccion.numero,
        ciudad: direccion.ciudad,
        tipo: this.toPrismaTipoDireccion(direccion.tipo),
        principal: direccion.principal,
      };
      if (direccion.id && idsActuales.has(direccion.id)) {
        await tx.empleadoDireccion.update({
          where: { id: direccion.id },
          data,
        });
      } else {
        await tx.empleadoDireccion.create({
          data: {
            ...(direccion.id ? { id: direccion.id } : {}),
            tenantId,
            empleadoId,
            ...data,
          },
        });
      }
    }
  }

  private async sincronizarComisiones(
    tx: Prisma.TransactionClient,
    tenantId: string,
    empleadoId: string,
    actuales: EmpleadoComision[],
    entrantes: ReturnType<EmpleadosService['normalizeComisiones']>,
  ) {
    const idsActuales = new Set(actuales.map((item) => item.id));
    const idsConservar = entrantes
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id && idsActuales.has(id)));
    await tx.empleadoComision.deleteMany({
      where: {
        tenantId,
        empleadoId,
        ...(idsConservar.length > 0 ? { id: { notIn: idsConservar } } : {}),
      },
    });
    for (const comision of entrantes) {
      const data = {
        descripcion: comision.descripcion,
        tipo: this.toPrismaTipoComision(comision.tipo),
        valor: new Prisma.Decimal(comision.valor),
      };
      if (comision.id && idsActuales.has(comision.id)) {
        await tx.empleadoComision.update({ where: { id: comision.id }, data });
      } else {
        await tx.empleadoComision.create({
          data: {
            ...(comision.id ? { id: comision.id } : {}),
            tenantId,
            empleadoId,
            ...data,
          },
        });
      }
    }
  }

  private async findEmpleadoOrThrow(
    auth: CurrentAuth,
    id: string,
    db: PrismaService | Prisma.TransactionClient,
  ): Promise<EmpleadoCompleto> {
    const empleado = await db.empleado.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: this.includeParaTenant(auth.tenantId),
    });
    if (!empleado) throw new NotFoundException(`No existe el empleado ${id}`);
    return empleado as EmpleadoCompleto;
  }

  private includeParaTenant(tenantId: string): Prisma.EmpleadoInclude {
    return {
      direcciones: { orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }] },
      comisiones: { orderBy: { createdAt: 'asc' } },
      eventos: { orderBy: { createdAt: 'desc' }, take: 30 },
      user: { include: { memberships: { where: { tenantId } } } },
    };
  }

  private normalizePayload(payload: UpsertEmpleadoDto) {
    const fechaIngreso = this.fecha(payload.fechaIngreso);
    const fechaNacimiento = payload.fechaNacimiento
      ? this.fecha(payload.fechaNacimiento)
      : null;
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
    if (fechaIngreso > hoy) {
      throw new BadRequestException('La fecha de ingreso no puede ser futura.');
    }
    if (fechaNacimiento && fechaNacimiento > hoy) {
      throw new BadRequestException(
        'La fecha de nacimiento no puede ser futura.',
      );
    }
    if (fechaNacimiento && fechaNacimiento >= fechaIngreso) {
      throw new BadRequestException(
        'La fecha de nacimiento debe ser anterior a la fecha de ingreso.',
      );
    }
    return {
      nombreCompleto: payload.nombreCompleto.trim(),
      email: payload.email.trim().toLowerCase(),
      telefonoCodigo: payload.telefonoCodigo.replace(/\D/g, ''),
      telefonoNumero: payload.telefonoNumero.trim(),
      sector: payload.sector.trim(),
      ocupacion: payload.ocupacion?.trim() || null,
      sexo: payload.sexo ? this.toPrismaSexo(payload.sexo) : null,
      fechaIngreso,
      fechaNacimiento,
      comisionesHabilitadas: payload.comisionesHabilitadas,
      direcciones: this.normalizeDirecciones(payload.direcciones),
      comisiones: payload.comisionesHabilitadas
        ? this.normalizeComisiones(payload.comisiones)
        : [],
    };
  }

  private fecha(value: string) {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private normalizeDirecciones(direcciones: EmpleadoDireccionDto[]) {
    if (direcciones.length === 0) return [];
    const base = direcciones.map((direccion) => ({
      ...direccion,
      descripcion: direccion.descripcion.trim(),
      pais: direccion.pais.trim().toUpperCase(),
      codigoPostal: direccion.codigoPostal?.trim() || null,
      direccion: direccion.direccion.trim(),
      numero: direccion.numero?.trim() || null,
      ciudad: direccion.ciudad.trim(),
    }));
    const principal = base.findIndex((direccion) => direccion.principal);
    return base.map((direccion, index) => ({
      ...direccion,
      principal: principal === -1 ? index === 0 : index === principal,
    }));
  }

  private normalizeComisiones(comisiones: EmpleadoComisionDto[]) {
    return comisiones.map((comision) => {
      const valor = new Prisma.Decimal(comision.valor.replace(',', '.'));
      if (valor.lte(0)) {
        throw new BadRequestException('La comisión debe ser mayor que cero.');
      }
      if (comision.tipo === TipoComisionDto.porcentaje && valor.gt(100)) {
        throw new BadRequestException(
          'La comisión porcentual no puede superar 100%.',
        );
      }
      if (comision.tipo === TipoComisionDto.fijo && valor.gt('99999999.99')) {
        throw new BadRequestException(
          'La comisión fija supera el máximo permitido.',
        );
      }
      return {
        ...comision,
        descripcion: comision.descripcion.trim(),
        valor: valor.toFixed(2),
      };
    });
  }

  private exigirPermisoComisionesSiCorresponde(
    auth: CurrentAuth,
    payload: UpsertEmpleadoDto,
  ) {
    if (
      !this.puedeVerComisiones(auth) &&
      (payload.comisionesHabilitadas || payload.comisiones.length > 0)
    ) {
      throw new ForbiddenException(
        'No tenés permiso para configurar comisiones de empleados.',
      );
    }
  }

  private puedeVerComisiones(auth: CurrentAuth) {
    return (
      auth.role === RolSistema.ADMINISTRADOR ||
      Boolean(auth.permisos?.has('registros.ver_comisiones'))
    );
  }

  private toResponse(empleado: EmpleadoCompleto, incluirComisiones: boolean) {
    const direccionPrincipal =
      empleado.direcciones.find((direccion) => direccion.principal) ?? null;
    const membership = empleado.user?.memberships[0] ?? null;
    return {
      id: empleado.id,
      nombreCompleto: empleado.nombreCompleto,
      email: empleado.emailPrincipal,
      telefonoCodigo: empleado.telefonoCodigo,
      telefonoNumero: empleado.telefonoNumero,
      sector: empleado.sector,
      ocupacion: empleado.ocupacion ?? '',
      sexo: empleado.sexo ? this.fromPrismaSexo(empleado.sexo) : '',
      fechaIngreso: this.toDateInput(empleado.fechaIngreso),
      fechaNacimiento: empleado.fechaNacimiento
        ? this.toDateInput(empleado.fechaNacimiento)
        : '',
      activo: empleado.activo,
      fechaBaja: empleado.fechaBaja ? this.toDateInput(empleado.fechaBaja) : '',
      motivoBaja: empleado.motivoBaja ?? '',
      updatedAt: empleado.updatedAt.toISOString(),
      usuarioSistema: Boolean(empleado.user && membership?.activa),
      emailAcceso: empleado.user?.email ?? '',
      rolSistema: membership ? this.fromPrismaRol(membership.rol) : '',
      comisionesVisibles: incluirComisiones,
      comisionesHabilitadas: incluirComisiones
        ? empleado.comisionesHabilitadas
        : false,
      ciudad: direccionPrincipal?.ciudad ?? '',
      direcciones: empleado.direcciones.map((direccion) => ({
        id: direccion.id,
        descripcion: direccion.descripcion,
        pais: direccion.paisCodigo,
        codigoPostal: direccion.codigoPostal ?? '',
        direccion: direccion.direccion,
        numero: direccion.numero ?? '',
        ciudad: direccion.ciudad,
        tipo: this.fromPrismaTipoDireccion(direccion.tipo),
        principal: direccion.principal,
      })),
      comisiones: incluirComisiones
        ? empleado.comisiones.map((comision) => ({
            id: comision.id,
            descripcion: comision.descripcion,
            tipo: this.fromPrismaTipoComision(comision.tipo),
            valor: comision.valor.toString(),
          }))
        : [],
      eventos: empleado.eventos.map((evento) => ({
        id: evento.id,
        tipo: evento.tipo,
        actorNombre: evento.actorNombre ?? 'Sistema',
        detalle: evento.detalle,
        createdAt: evento.createdAt.toISOString(),
      })),
    };
  }

  private toDateInput(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private toPrismaTipoDireccion(tipo: TipoDireccionDto) {
    const mapping: Record<TipoDireccionDto, TipoDireccion> = {
      principal: TipoDireccion.PRINCIPAL,
      facturacion: TipoDireccion.FACTURACION,
      entrega: TipoDireccion.ENTREGA,
    };
    return mapping[tipo];
  }

  private fromPrismaTipoDireccion(tipo: TipoDireccion) {
    const mapping: Record<TipoDireccion, TipoDireccionDto> = {
      PRINCIPAL: TipoDireccionDto.principal,
      FACTURACION: TipoDireccionDto.facturacion,
      ENTREGA: TipoDireccionDto.entrega,
    };
    return mapping[tipo];
  }

  private toPrismaSexo(sexo: SexoEmpleadoDto) {
    const mapping: Record<SexoEmpleadoDto, SexoEmpleado> = {
      masculino: SexoEmpleado.MASCULINO,
      femenino: SexoEmpleado.FEMENINO,
      no_binario: SexoEmpleado.NO_BINARIO,
      prefiero_no_decir: SexoEmpleado.PREFIERO_NO_DECIR,
    };
    return mapping[sexo];
  }

  private fromPrismaSexo(sexo: SexoEmpleado) {
    const mapping: Record<SexoEmpleado, SexoEmpleadoDto> = {
      MASCULINO: SexoEmpleadoDto.masculino,
      FEMENINO: SexoEmpleadoDto.femenino,
      NO_BINARIO: SexoEmpleadoDto.no_binario,
      PREFIERO_NO_DECIR: SexoEmpleadoDto.prefiero_no_decir,
    };
    return mapping[sexo];
  }

  private fromPrismaRol(rol: RolSistema) {
    const mapping: Record<RolSistema, string> = {
      ADMINISTRADOR: 'administrador',
      SUPERVISOR: 'supervisor',
      OPERADOR: 'operador',
    };
    return mapping[rol];
  }

  private toPrismaTipoComision(tipo: TipoComisionDto) {
    return tipo === TipoComisionDto.porcentaje
      ? TipoComision.PORCENTAJE
      : TipoComision.FIJO;
  }

  private fromPrismaTipoComision(tipo: TipoComision) {
    return tipo === TipoComision.PORCENTAJE
      ? TipoComisionDto.porcentaje
      : TipoComisionDto.fijo;
  }
}
