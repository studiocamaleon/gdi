import { contratoSuscripcion } from './contrato-suscripcion';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolverAccesoEmpresa } from './acceso-empresa';
import { bloquearCupoUsuarios } from './cupos-usuarios';
import { exigirContinuidadCompromiso } from './contratacion-pendiente';
import {
  decisionCapacidad,
  type ClaveCapacidad,
} from './evaluador-capacidades';

type LecturaEmpresa = Pick<Prisma.TransactionClient, 'tenant'>;

@Injectable()
export class CapacidadesEmpresaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Primera operación de una transacción escritora. Conserva el contrato hasta
   * el commit. Las funciones de continuidad pueden incluir las necesarias para
   * cerrar el compromiso, además de las exigidas para iniciarlo. */
  async exigirOperacionTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    requeridas: ClaveCapacidad[],
    compromisos: ClaveCapacidad[] = [],
  ) {
    await bloquearCupoUsuarios(tx, tenantId);
    await this.exigirTodas(tenantId, requeridas, tx);
    if (compromisos.length)
      await exigirContinuidadCompromiso(tx, tenantId, compromisos);
  }

  /** Lectura local, sin llamar a la pasarela. No acepta el plan enviado por el
   * cliente ni consulta borradores para conceder derechos. */
  async actual(tenantId: string, db: LecturaEmpresa = this.prisma) {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        nombre: true,
        activo: true,
        bloqueoAccesoMotivo: true,
        cuotaBytesArchivos: true,
        suscripcion: {
          select: {
            usuariosAdicionales: true,
            planVersion: true,
            estado: true,
            proveedor: true,
            estadoProveedor: true,
            trialHasta: true,
            graciaHasta: true,
            plan: { select: { nombre: true, featuresJson: true } },
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException('No se encontró la empresa.');
    const contrato = contratoSuscripcion(tenant.suscripcion);
    return {
      empresa: { id: tenant.id, nombre: tenant.nombre },
      acceso: resolverAccesoEmpresa(
        tenant.activo,
        tenant.suscripcion,
        tenant.bloqueoAccesoMotivo,
      ),
      contrato,
      almacenamientoAjustadoBytes: tenant.cuotaBytesArchivos
        ? String(tenant.cuotaBytesArchivos)
        : null,
    };
  }

  async incluida(tenantId: string, clave: ClaveCapacidad, db?: LecturaEmpresa) {
    const actual = await this.actual(tenantId, db);
    return decisionCapacidad(actual.contrato, clave, actual.acceso).incluida;
  }

  async puedeOperar(
    tenantId: string,
    clave: ClaveCapacidad,
    db?: LecturaEmpresa,
  ) {
    const actual = await this.actual(tenantId, db);
    return decisionCapacidad(actual.contrato, clave, actual.acceso).puedeOperar;
  }

  async exigir(tenantId: string, clave: ClaveCapacidad, db?: LecturaEmpresa) {
    return this.exigirTodas(tenantId, [clave], db);
  }

  async exigirTodas(
    tenantId: string,
    claves: ClaveCapacidad[],
    db?: LecturaEmpresa,
  ) {
    if (!claves.length) return;
    const actual = await this.actual(tenantId, db);
    for (const clave of new Set(claves)) {
      const decision = decisionCapacidad(actual.contrato, clave, actual.acceso);
      if (!decision.puedeOperar)
        throw new ForbiddenException({
          code: 'CAPACIDAD_NO_DISPONIBLE',
          capacidad: clave,
          motivo: decision.motivo,
          message:
            actual.acceso.modo !== 'operativo'
              ? actual.acceso.descripcion
              : 'Esta función no está incluida en el plan de la empresa.',
        });
    }
  }

  async exigirAlguna(tenantId: string, claves: ClaveCapacidad[]) {
    const actual = await this.actual(tenantId);
    if (
      claves.some(
        (clave) =>
          decisionCapacidad(actual.contrato, clave, actual.acceso).puedeOperar,
      )
    )
      return;
    throw new ForbiddenException({
      code: 'CAPACIDAD_NO_DISPONIBLE',
      capacidades: claves,
      message:
        actual.acceso.modo !== 'operativo'
          ? actual.acceso.descripcion
          : 'Esta función no está incluida en el plan de la empresa.',
    });
  }

  async exigirAlgunaIncluida(tenantId: string, claves: ClaveCapacidad[]) {
    const actual = await this.actual(tenantId);
    if (
      !claves.some(
        (clave) =>
          decisionCapacidad(actual.contrato, clave, actual.acceso).incluida,
      )
    ) {
      throw new ForbiddenException({
        code: 'CAPACIDAD_NO_INCLUIDA',
        capacidades: claves,
        message: 'Esta función no está incluida en el plan de la empresa.',
      });
    }
  }

  async exigirIncluida(
    tenantId: string,
    clave: ClaveCapacidad,
    db?: LecturaEmpresa,
  ) {
    if (!(await this.incluida(tenantId, clave, db)))
      throw new ForbiddenException({
        code: 'CAPACIDAD_NO_INCLUIDA',
        capacidad: clave,
        message: 'Esta función no está incluida en el plan de la empresa.',
      });
  }
}
