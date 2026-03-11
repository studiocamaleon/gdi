import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Empleado,
  EmpleadoComision,
  EmpleadoDireccion,
  Membership,
  Prisma,
  RolSistema,
  SexoEmpleado,
  TipoComision,
  TipoDireccion,
  User,
} from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { EmpleadoComisionDto, TipoComisionDto } from './dto/comision.dto';
import { EmpleadoDireccionDto, TipoDireccionDto } from './dto/direccion.dto';
import { InvitarAccesoDto } from './dto/invitar-acceso.dto';
import {
  RolSistemaDto,
  SexoEmpleadoDto,
  UpsertEmpleadoDto,
} from './dto/upsert-empleado.dto';

type EmpleadoCompleto = Empleado & {
  direcciones: EmpleadoDireccion[];
  comisiones: EmpleadoComision[];
  user: (User & { memberships: Membership[] }) | null;
};

@Injectable()
export class EmpleadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll(auth: CurrentAuth) {
    const empleados = await this.prisma.empleado.findMany({
      where: {
        tenantId: auth.tenantId,
      },
      include: {
        direcciones: {
          orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
        },
        comisiones: {
          orderBy: { createdAt: 'asc' },
        },
        user: {
          include: {
            memberships: {
              where: {
                tenantId: auth.tenantId,
              },
            },
          },
        },
      },
      orderBy: {
        nombreCompleto: 'asc',
      },
    });

    return empleados.map((empleado) => this.toResponse(empleado));
  }

  async findOne(auth: CurrentAuth, id: string) {
    const empleado = await this.findEmpleadoOrThrow(auth, id, this.prisma);
    return this.toResponse(empleado);
  }

  async create(auth: CurrentAuth, payload: UpsertEmpleadoDto) {
    const normalized = this.normalizePayload(payload);

    const empleado = await this.prisma.empleado.create({
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
            tenantId: auth.tenantId,
            descripcion: comision.descripcion,
            tipo: this.toPrismaTipoComision(comision.tipo),
            valor: new Prisma.Decimal(comision.valor),
          })),
        },
      },
      include: {
        direcciones: true,
        comisiones: true,
        user: {
          include: {
            memberships: {
              where: { tenantId: auth.tenantId },
            },
          },
        },
      },
    });

    await this.syncAccess(auth, empleado.id, normalized);

    const fresh = await this.findEmpleadoOrThrow(
      auth,
      empleado.id,
      this.prisma,
    );
    return this.toResponse(fresh);
  }

  async update(auth: CurrentAuth, id: string, payload: UpsertEmpleadoDto) {
    const normalized = this.normalizePayload(payload);

    await this.prisma.$transaction(async (tx) => {
      await this.findEmpleadoOrThrow(auth, id, tx);

      await tx.empleado.update({
        where: { id },
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
          comisionesHabilitadas: normalized.comisionesHabilitadas,
        },
      });

      await tx.empleadoDireccion.deleteMany({
        where: { empleadoId: id, tenantId: auth.tenantId },
      });

      await tx.empleadoComision.deleteMany({
        where: { empleadoId: id, tenantId: auth.tenantId },
      });

      if (normalized.direcciones.length > 0) {
        await tx.empleadoDireccion.createMany({
          data: normalized.direcciones.map((direccion) => ({
            tenantId: auth.tenantId,
            empleadoId: id,
            descripcion: direccion.descripcion,
            paisCodigo: direccion.pais,
            codigoPostal: direccion.codigoPostal,
            direccion: direccion.direccion,
            numero: direccion.numero,
            ciudad: direccion.ciudad,
            tipo: this.toPrismaTipoDireccion(direccion.tipo),
            principal: direccion.principal,
          })),
        });
      }

      if (normalized.comisiones.length > 0) {
        await tx.empleadoComision.createMany({
          data: normalized.comisiones.map((comision) => ({
            tenantId: auth.tenantId,
            empleadoId: id,
            descripcion: comision.descripcion,
            tipo: this.toPrismaTipoComision(comision.tipo),
            valor: new Prisma.Decimal(comision.valor),
          })),
        });
      }
    });

    await this.syncAccess(auth, id, normalized);

    const empleado = await this.findEmpleadoOrThrow(auth, id, this.prisma);
    return this.toResponse(empleado);
  }

  async invitarAcceso(
    auth: CurrentAuth,
    id: string,
    payload: InvitarAccesoDto,
  ) {
    await this.findEmpleadoOrThrow(auth, id, this.prisma);

    return this.authService.provisionEmployeeAccess(
      auth,
      id,
      payload.email,
      this.toPrismaRol(payload.rolSistema),
    );
  }

  async remove(auth: CurrentAuth, id: string) {
    await this.findEmpleadoOrThrow(auth, id, this.prisma);
    await this.authService.revokeEmployeeAccess(auth, id);
    await this.prisma.empleado.delete({
      where: { id },
    });
  }

  private async syncAccess(
    auth: CurrentAuth,
    empleadoId: string,
    normalized: ReturnType<EmpleadosService['normalizePayload']>,
  ) {
    if (
      !normalized.usuarioSistema ||
      !normalized.emailAcceso ||
      !normalized.rolSistema
    ) {
      await this.authService.revokeEmployeeAccess(auth, empleadoId);
      return;
    }

    await this.authService.provisionEmployeeAccess(
      auth,
      empleadoId,
      normalized.emailAcceso,
      normalized.rolSistema,
    );
  }

  private async findEmpleadoOrThrow(
    auth: CurrentAuth,
    id: string,
    db: PrismaService | Prisma.TransactionClient,
  ) {
    const empleado = await db.empleado.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      include: {
        direcciones: {
          orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
        },
        comisiones: {
          orderBy: { createdAt: 'asc' },
        },
        user: {
          include: {
            memberships: {
              where: { tenantId: auth.tenantId },
            },
          },
        },
      },
    });

    if (!empleado) {
      throw new NotFoundException(`No existe el empleado ${id}`);
    }

    return empleado;
  }

  private normalizePayload(payload: UpsertEmpleadoDto) {
    return {
      ...payload,
      nombreCompleto: payload.nombreCompleto.trim(),
      email: payload.email.trim().toLowerCase(),
      telefonoCodigo: payload.telefonoCodigo.trim(),
      telefonoNumero: payload.telefonoNumero.trim(),
      sector: payload.sector.trim(),
      ocupacion: payload.ocupacion?.trim() || null,
      sexo: payload.sexo ? this.toPrismaSexo(payload.sexo) : null,
      fechaIngreso: new Date(payload.fechaIngreso),
      fechaNacimiento: payload.fechaNacimiento
        ? new Date(payload.fechaNacimiento)
        : null,
      usuarioSistema: payload.usuarioSistema,
      emailAcceso: payload.usuarioSistema
        ? payload.emailAcceso?.trim().toLowerCase() || null
        : null,
      rolSistema:
        payload.usuarioSistema && payload.rolSistema
          ? this.toPrismaRol(payload.rolSistema)
          : null,
      comisionesHabilitadas: payload.comisionesHabilitadas,
      direcciones: this.normalizeDirecciones(payload.direcciones),
      comisiones: payload.comisionesHabilitadas
        ? this.normalizeComisiones(payload.comisiones)
        : [],
    };
  }

  private normalizeDirecciones(direcciones: EmpleadoDireccionDto[]) {
    if (direcciones.length === 0) {
      return [];
    }

    const base = direcciones.map((direccion) => ({
      ...direccion,
      descripcion: direccion.descripcion.trim(),
      pais: direccion.pais.trim().toUpperCase(),
      codigoPostal: direccion.codigoPostal?.trim() || null,
      direccion: direccion.direccion.trim(),
      numero: direccion.numero?.trim() || null,
      ciudad: direccion.ciudad.trim(),
      principal: direccion.principal,
    }));

    const principalIndex = base.findIndex((direccion) => direccion.principal);

    return base.map((direccion, index) => ({
      ...direccion,
      principal: principalIndex === -1 ? index === 0 : index === principalIndex,
    }));
  }

  private normalizeComisiones(comisiones: EmpleadoComisionDto[]) {
    return comisiones.map((comision) => ({
      ...comision,
      descripcion: comision.descripcion.trim(),
      valor: comision.valor.trim(),
    }));
  }

  private toResponse(empleado: EmpleadoCompleto) {
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
      usuarioSistema: Boolean(empleado.user && membership?.activa),
      emailAcceso: empleado.user?.email ?? '',
      rolSistema: membership ? this.fromPrismaRol(membership.rol) : '',
      comisionesHabilitadas: empleado.comisionesHabilitadas,
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
      comisiones: empleado.comisiones.map((comision) => ({
        id: comision.id,
        descripcion: comision.descripcion,
        tipo: this.fromPrismaTipoComision(comision.tipo),
        valor: comision.valor.toString(),
      })),
    };
  }

  private toDateInput(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private toPrismaTipoDireccion(tipo: TipoDireccionDto) {
    const mapping: Record<TipoDireccionDto, TipoDireccion> = {
      [TipoDireccionDto.principal]: TipoDireccion.PRINCIPAL,
      [TipoDireccionDto.facturacion]: TipoDireccion.FACTURACION,
      [TipoDireccionDto.entrega]: TipoDireccion.ENTREGA,
    };

    return mapping[tipo];
  }

  private fromPrismaTipoDireccion(tipo: TipoDireccion) {
    const mapping: Record<TipoDireccion, TipoDireccionDto> = {
      [TipoDireccion.PRINCIPAL]: TipoDireccionDto.principal,
      [TipoDireccion.FACTURACION]: TipoDireccionDto.facturacion,
      [TipoDireccion.ENTREGA]: TipoDireccionDto.entrega,
    };

    return mapping[tipo];
  }

  private toPrismaSexo(sexo: SexoEmpleadoDto) {
    const mapping: Record<SexoEmpleadoDto, SexoEmpleado> = {
      [SexoEmpleadoDto.masculino]: SexoEmpleado.MASCULINO,
      [SexoEmpleadoDto.femenino]: SexoEmpleado.FEMENINO,
      [SexoEmpleadoDto.no_binario]: SexoEmpleado.NO_BINARIO,
      [SexoEmpleadoDto.prefiero_no_decir]: SexoEmpleado.PREFIERO_NO_DECIR,
    };

    return mapping[sexo];
  }

  private fromPrismaSexo(sexo: SexoEmpleado) {
    const mapping: Record<SexoEmpleado, SexoEmpleadoDto> = {
      [SexoEmpleado.MASCULINO]: SexoEmpleadoDto.masculino,
      [SexoEmpleado.FEMENINO]: SexoEmpleadoDto.femenino,
      [SexoEmpleado.NO_BINARIO]: SexoEmpleadoDto.no_binario,
      [SexoEmpleado.PREFIERO_NO_DECIR]: SexoEmpleadoDto.prefiero_no_decir,
    };

    return mapping[sexo];
  }

  private toPrismaRol(rol: RolSistemaDto) {
    const mapping: Record<RolSistemaDto, RolSistema> = {
      [RolSistemaDto.administrador]: RolSistema.ADMINISTRADOR,
      [RolSistemaDto.supervisor]: RolSistema.SUPERVISOR,
      [RolSistemaDto.operador]: RolSistema.OPERADOR,
    };

    return mapping[rol];
  }

  private fromPrismaRol(rol: RolSistema) {
    const mapping: Record<RolSistema, RolSistemaDto> = {
      [RolSistema.ADMINISTRADOR]: RolSistemaDto.administrador,
      [RolSistema.SUPERVISOR]: RolSistemaDto.supervisor,
      [RolSistema.OPERADOR]: RolSistemaDto.operador,
    };

    return mapping[rol];
  }

  private toPrismaTipoComision(tipo: TipoComisionDto) {
    const mapping: Record<TipoComisionDto, TipoComision> = {
      [TipoComisionDto.porcentaje]: TipoComision.PORCENTAJE,
      [TipoComisionDto.fijo]: TipoComision.FIJO,
    };

    return mapping[tipo];
  }

  private fromPrismaTipoComision(tipo: TipoComision) {
    const mapping: Record<TipoComision, TipoComisionDto> = {
      [TipoComision.PORCENTAJE]: TipoComisionDto.porcentaje,
      [TipoComision.FIJO]: TipoComisionDto.fijo,
    };

    return mapping[tipo];
  }
}
