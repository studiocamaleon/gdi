/* eslint-disable @typescript-eslint/unbound-method -- Los handlers se usan para leer metadata de Nest, sin invocarlos. */
import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from '../auth.controller';
import { AuthGuard } from '../auth.guard';
import { SessionCacheService } from '../session-cache.service';
import { PlataformaController } from '../../plataforma/plataforma.controller';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../auth.types';

function escenario(clavePendiente: boolean, mfaCompleta: boolean) {
  const now = new Date();
  const session = {
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86_400_000),
    createdAt: now,
    userId: 'staff',
    mfaVerificadoEl: mfaCompleta ? now : null,
    user: {
      activo: true,
      rolPlataforma: 'ADMIN',
      debeCambiarPassword: clavePendiente,
      mfa: mfaCompleta
        ? { activatedAt: now, recuperacionConfirmadaEl: now }
        : null,
    },
  };
  const prisma = {
    authSession: { findUnique: jest.fn().mockResolvedValue(session) },
  };
  const jwt = {
    verifyAsync: jest.fn().mockResolvedValue({
      plat: true,
      sub: 'staff',
      sessionId: 'sesion',
      role: 'ADMINISTRADOR',
      email: 'staff@example.invalid',
    }),
  };
  const guard = new AuthGuard(
    new Reflector(),
    jwt as unknown as JwtService,
    prisma as unknown as PrismaService,
    new SessionCacheService(),
  );
  const request: { headers: Record<string, string>; auth?: CurrentAuth } = {
    headers: { authorization: 'Bearer token-de-ensayo' },
  };
  const contexto = (
    controller: typeof AuthController | typeof PlataformaController,
    handler: (...args: never[]) => unknown,
  ) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
      getClass: () => controller,
      getHandler: () => handler,
    }) as unknown as ExecutionContext;
  return { session, guard, request, contexto };
}

describe('Cambio de clave del staff sin empresa', () => {
  it.each([true, false])(
    'permite cambiar la clave propia con MFA completa=%s',
    async (mfaCompleta) => {
      const s = escenario(true, mfaCompleta);
      await expect(
        s.guard.canActivate(
          s.contexto(AuthController, AuthController.prototype.cambiarPassword),
        ),
      ).resolves.toBe(true);
      expect(s.request.auth?.plataformaPasswordPendiente).toBe(true);
      expect(s.request.auth?.tenantId).toBe('');
    },
  );

  it('bloquea la consola con clave provisoria aunque MFA ya esté completa; reconsulta al cambiar la clave', async () => {
    const s = escenario(true, true);
    const consoleContext = s.contexto(
      PlataformaController,
      PlataformaController.prototype.consola,
    );
    await expect(s.guard.canActivate(consoleContext)).rejects.toThrow(
      /clave personal/,
    );
    await expect(
      s.guard.canActivate(
        s.contexto(
          PlataformaController,
          PlataformaController.prototype.contexto,
        ),
      ),
    ).resolves.toBe(true);
    s.session.user.debeCambiarPassword = false;
    await expect(s.guard.canActivate(consoleContext)).resolves.toBe(true);
    expect(s.request.auth?.plataformaPasswordPendiente).toBe(false);
  });

  it('cambiar la clave no permite saltar MFA ni entrar a rutas de tenant', async () => {
    const s = escenario(false, false);
    await expect(
      s.guard.canActivate(
        s.contexto(
          PlataformaController,
          PlataformaController.prototype.consola,
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      s.guard.canActivate(
        s.contexto(AuthController, AuthController.prototype.getCurrentContext),
      ),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      s.guard.canActivate(
        s.contexto(AuthController, AuthController.prototype.logout),
      ),
    ).resolves.toBe(true);
  });
});
