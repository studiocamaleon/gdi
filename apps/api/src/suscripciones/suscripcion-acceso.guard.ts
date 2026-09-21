import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { PERMITIR_SUSCRIPCION_INACTIVA_KEY } from './permitir-suscripcion-inactiva.decorator';
import { resolverAccesoEmpresa } from './acceso-empresa';

/**
 * Una suscripción suspendida conserva lectura y exportación, pero no puede
 * crear ni modificar datos. El bloqueo real vive en el API: ocultar botones
 * en el navegador sería sólo cosmético.
 */
@Injectable()
export class SuscripcionAccesoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      method: string;
      auth?: CurrentAuth;
    }>();
    if (!request.auth?.tenantId) return true;
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
      return true;
    }
    const permitido = this.reflector.getAllAndOverride<boolean>(
      PERMITIR_SUSCRIPCION_INACTIVA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (permitido) return true;

    const suscripcion = await this.prisma.suscripcion.findFirst({
      where: { tenantId: request.auth.tenantId },
      select: {
        estado: true,
        proveedor: true,
        estadoProveedor: true,
        trialHasta: true,
        graciaHasta: true,
      },
    });
    // Los tenants legacy sin suscripción conservan su acceso actual.
    const acceso = resolverAccesoEmpresa(true, suscripcion);
    if (acceso.modo === 'operativo') return true;

    throw new HttpException(
      {
        message: `${acceso.descripcion} Revisá Plan y facturación para volver a operar.`,
        code: 'SUSCRIPCION_SOLO_LECTURA',
      },
      402,
    );
  }
}
