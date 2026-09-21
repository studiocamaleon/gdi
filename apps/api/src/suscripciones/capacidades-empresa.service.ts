import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolverAccesoEmpresa } from './acceso-empresa';
import {
  contratoCompatible,
  decisionCapacidad,
  type ClaveCapacidad,
} from './evaluador-capacidades';

type LecturaEmpresa = Pick<Prisma.TransactionClient, 'tenant'>;

@Injectable()
export class CapacidadesEmpresaService {
  constructor(private readonly prisma: PrismaService) {}

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
    const contrato = contratoCompatible(tenant.suscripcion?.plan ?? null);
    if (contrato.limites.usuariosMax !== null)
      contrato.limites.usuariosMax += tenant.suscripcion?.usuariosAdicionales ?? 0;
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
    const actual = await this.actual(tenantId, db);
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
