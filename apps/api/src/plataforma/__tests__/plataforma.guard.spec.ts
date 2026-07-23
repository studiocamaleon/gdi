import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { RolPlataforma } from '@prisma/client';
import { PlataformaGuard } from '../plataforma.guard';
import { PlataformaController } from '../plataforma.controller';
import { SIN_TENANT_KEY } from '../../common/sin-tenant.decorator';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * La puerta del control plane. Lo que fija esta suite:
 *  - sin rol de plataforma no se entra, con cualquier rol de TENANT que se
 *    tenga (la separación de planos es el diseño entero);
 *  - el controller lleva las DOS marcas — guard y @SinTenant() — porque
 *    perder cualquiera de ellas falla en silencio: sin guard entra
 *    cualquiera, sin @SinTenant() la consola devuelve sólo el tenant del
 *    staff y parece que anda.
 */

function contextoCon(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guardCon(
  user: { activo: boolean; rolPlataforma: RolPlataforma | null } | null,
) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
  } as unknown as PrismaService;
  return new PlataformaGuard(prisma);
}

const AUTH = { userId: 'u1' };

describe('PlataformaGuard', () => {
  it('sin auth en el request rebota (el AuthGuard global tendría que haber corrido)', async () => {
    await expect(guardCon(null).canActivate(contextoCon({}))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('un usuario de tenant SIN rol de plataforma recibe 403', async () => {
    const guard = guardCon({ activo: true, rolPlataforma: null });
    await expect(
      guard.canActivate(contextoCon({ auth: AUTH })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('un usuario desactivado no entra aunque conserve el rol', async () => {
    const guard = guardCon({
      activo: false,
      rolPlataforma: RolPlataforma.ADMIN,
    });
    await expect(
      guard.canActivate(contextoCon({ auth: AUTH })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('SOPORTE pasa y deja el rol en el request para los handlers', async () => {
    const guard = guardCon({
      activo: true,
      rolPlataforma: RolPlataforma.SOPORTE,
    });
    const request: Record<string, unknown> = { auth: AUTH };
    await expect(guard.canActivate(contextoCon(request))).resolves.toBe(true);
    expect(request.rolPlataforma).toBe(RolPlataforma.SOPORTE);
  });
});

describe('PlataformaController — las marcas del plano', () => {
  it('lleva @SinTenant(): sin esto la consola se filtra al tenant del staff', () => {
    expect(Reflect.getMetadata(SIN_TENANT_KEY, PlataformaController)).toBe(
      true,
    );
  });

  it('lleva el PlataformaGuard: sin esto entra cualquier sesión', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      PlataformaController,
    ) as unknown[];
    expect(guards).toContain(PlataformaGuard);
  });
});
