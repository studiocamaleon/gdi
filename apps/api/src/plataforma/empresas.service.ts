import { resumenCupoUsuarios } from '../suscripciones/cupos-usuarios';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolverAccesoEmpresa } from '../suscripciones/acceso-empresa';
import {
  contratoSuscripcion,
  funcionHistoricaEnContrato,
} from '../suscripciones/contrato-suscripcion';
import type { ClaveFuncionPlan } from '../suscripciones/capacidades-plan';

export type ConsultaEmpresas = {
  pagina: number;
  limite: number;
  q?: string;
  acceso?: 'habilitado' | 'bloqueado';
};

@Injectable()
export class EmpresasPlataformaService {
  constructor(private readonly prisma: PrismaService) {}

  async contexto(userId: string, esSesionPlataforma: boolean) {
    const staff = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nombreCompleto: true, email: true, rolPlataforma: true },
    });
    if (!staff) throw new NotFoundException('El operador no existe.');
    return {
      nombre: staff.nombreCompleto,
      email: staff.email,
      rol: staff.rolPlataforma!,
      esSesionPlataforma,
    };
  }

  async listar(consulta: ConsultaEmpresas) {
    const q = consulta.q?.trim();
    const where: Prisma.TenantWhereInput = {
      ...(consulta.acceso ? { activo: consulta.acceso === 'habilitado' } : {}),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
              {
                memberships: {
                  some: {
                    rol: 'ADMINISTRADOR',
                    user: { email: { contains: q, mode: 'insensitive' } },
                  },
                },
              },
              {
                suscripcion: {
                  referenciaExterna: { contains: q, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [total, empresas] = await this.prisma.$transaction([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
        where,
        skip: (consulta.pagina - 1) * consulta.limite,
        take: consulta.limite,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          nombre: true,
          slug: true,
          activo: true,
          bloqueoAccesoMotivo: true,
          createdAt: true,
          _count: {
            select: {
              memberships: { where: { activa: true, user: { activo: true } } },
            },
          },
          suscripcion: {
            include: {
              plan: {
                select: { nombre: true, codigo: true, featuresJson: true },
              },
              planVersion: true,
            },
          },
        },
      }),
    ]);
    return {
      pagina: consulta.pagina,
      limite: consulta.limite,
      total,
      empresas: empresas.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        slug: t.slug,
        activo: t.activo,
        creadoEl: t.createdAt.toISOString(),
        usuariosHabilitados: t._count.memberships,
        acceso: resolverAccesoEmpresa(
          t.activo,
          t.suscripcion,
          t.bloqueoAccesoMotivo,
        ),
        plan: t.suscripcion ? contratoSuscripcion(t.suscripcion).nombre : null,
        proveedor: t.suscripcion?.proveedor ?? null,
        estadoSuscripcion: t.suscripcion?.estado ?? null,
        estadoProveedor: t.suscripcion?.estadoProveedor ?? null,
      })),
    };
  }

  async detalle(id: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        slug: true,
        activo: true,
        bloqueoAccesoMotivo: true,
        bloqueoAccesoEl: true,
        createdAt: true,
        origenAlta: true,
        bytesArchivos: true,
        cuotaBytesArchivos: true,
        suscripcion: { include: { plan: true, planVersion: true } },
        _count: {
          select: {
            memberships: { where: { activa: true, user: { activo: true } } },
            invitations: {
              where: {
                acceptedAt: null,
                revokedAt: null,
                expiresAt: { gt: new Date() },
              },
            },
          },
        },
      },
    });
    if (!t) throw new NotFoundException('La empresa no existe.');
    const cupo = await resumenCupoUsuarios(this.prisma, id);
    const acceso = resolverAccesoEmpresa(
      t.activo,
      t.suscripcion,
      t.bloqueoAccesoMotivo,
    );
    const s = t.suscripcion;
    const contrato = contratoSuscripcion(s);
    const catalogo: Array<[ClaveFuncionPlan, string]> = [
      ['afip', 'Facturación electrónica'],
      ['whatsapp', 'WhatsApp'],
      ['centroCopiado', 'Centro de copiado'],
      ['impresionDirecta', 'Impresión directa'],
    ];
    const funciones = catalogo.map(([clave, nombre]) => {
      const incluida = funcionHistoricaEnContrato(contrato, clave);
      return {
        clave,
        nombre,
        incluida,
        habilitada: incluida && acceso.modo === 'operativo',
        motivo: !incluida
          ? 'No incluida en el plan.'
          : acceso.modo !== 'operativo'
            ? acceso.descripcion
            : s
              ? `Incluida en ${contrato.nombre}. Requiere los permisos y la configuración de la empresa.`
              : 'Disponible por compatibilidad con la cuenta anterior a los planes.',
      };
    });
    return {
      id: t.id,
      nombre: t.nombre,
      slug: t.slug,
      activo: t.activo,
      creadoEl: t.createdAt.toISOString(),
      origenAlta: t.origenAlta,
      bloqueo: {
        motivo: t.bloqueoAccesoMotivo,
        desde: t.bloqueoAccesoEl?.toISOString() ?? null,
      },
      acceso,
      usuariosHabilitados: cupo.activos,
      invitacionesPendientes: cupo.invitacionesPendientes,
      storageBytes: Number(t.bytesArchivos),
      storageCuotaBytes:
        t.cuotaBytesArchivos === null ? null : Number(t.cuotaBytesArchivos),
      puedeAsignarPlanManual:
        !s ||
        (s.proveedor === 'manual' && !s.referenciaExterna && !s.planVersionId),
      suscripcion: s
        ? {
            id: s.id,
            planId: s.planId,
            planNombre: contrato.nombre,
            versionId: s.planVersionId,
            versionNumero: s.planVersion?.numero ?? null,
            planComercialNombre: s.plan.nombre,
            planCodigo: s.plan.codigo,
            proveedor: s.proveedor,
            estado: s.estado,
            estadoProveedor: s.estadoProveedor,
            referenciaExterna: s.referenciaExterna,
            desde: s.desde.toISOString(),
            hasta: s.hasta?.toISOString() ?? null,
            trialHasta: s.trialHasta?.toISOString() ?? null,
            moraDesde: s.moraDesde?.toISOString() ?? null,
            graciaHasta: s.graciaHasta?.toISOString() ?? null,
            proximoCobro: s.proximoCobro?.toISOString() ?? null,
            cambioProgramado: s.cambioProgramado,
            cambioProgramadoEl: s.cambioProgramadoEl?.toISOString() ?? null,
            ultimaSyncProveedorEl:
              s.ultimaSyncProveedorEl?.toISOString() ?? null,
            ultimoEventoProveedorEl:
              s.ultimoEventoProveedorEl?.toISOString() ?? null,
          }
        : null,
      funciones,
      limites: {
        usuariosMax: contrato.limites.usuariosMax,
        ordenesMesMax: contrato.limites.ordenesMesMax,
        storageGb: contrato.limites.almacenamiento.gb,
      },
    };
  }

  private async existe(id: string) {
    if (
      !(await this.prisma.tenant.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new NotFoundException('La empresa no existe.');
  }

  async historial(id: string, pagina: number, limite: number) {
    await this.existe(id);
    const where = { tenantAfectadoId: id };
    const [total, eventos] = await this.prisma.$transaction([
      this.prisma.plataformaEvento.count({ where }),
      this.prisma.plataformaEvento.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * limite,
        take: limite,
        select: {
          id: true,
          tipo: true,
          descripcion: true,
          createdAt: true,
          staff: { select: { nombreCompleto: true, email: true } },
        },
      }),
    ]);
    return {
      total,
      pagina,
      limite,
      eventos: eventos.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        descripcion: e.descripcion,
        creadoEl: e.createdAt.toISOString(),
        staffNombre: e.staff.nombreCompleto,
        staffEmail: e.staff.email,
      })),
    };
  }

  async usuarios(id: string, pagina: number, limite: number) {
    // Relación explícitamente acotada: no consulta global de memberships.
    const empresa = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        _count: { select: { memberships: true } },
        memberships: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: (pagina - 1) * limite,
          take: limite,
          select: {
            id: true,
            activa: true,
            rol: true,
            rolDelTenant: { select: { nombre: true } },
            user: {
              select: { nombreCompleto: true, email: true, activo: true },
            },
          },
        },
      },
    });
    if (!empresa) throw new NotFoundException('La empresa no existe.');
    return {
      total: empresa._count.memberships,
      pagina,
      limite,
      usuarios: empresa.memberships.map((m) => ({
        id: m.id,
        nombre: m.user.nombreCompleto,
        email: m.user.email,
        rol: m.rolDelTenant?.nombre ?? m.rol,
        habilitado: m.activa && m.user.activo,
      })),
    };
  }
}
