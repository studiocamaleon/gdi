import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { SuscripcionAccesoGuard } from '../suscripcion-acceso.guard';
import { PERMITIR_SUSCRIPCION_INACTIVA_KEY } from '../permitir-suscripcion-inactiva.decorator';

describe('SuscripcionAccesoGuard', () => {
  const findFirst = jest.fn();
  const guard = new SuscripcionAccesoGuard(new Reflector(), {
    suscripcion: { findFirst },
  } as unknown as PrismaService);

  function contexto(method: string, permitido = false): ExecutionContext {
    class ControllerPrueba {}
    const handler = () => undefined;
    if (permitido) {
      Reflect.defineMetadata(
        PERMITIR_SUSCRIPCION_INACTIVA_KEY,
        true,
        handler,
      );
    }
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          auth: { tenantId: 'tenant-prueba' },
        }),
      }),
      getHandler: () => handler,
      getClass: () => ControllerPrueba,
    } as unknown as ExecutionContext;
  }

  beforeEach(() => findFirst.mockReset());

  it('mantiene todas las lecturas disponibles', async () => {
    await expect(guard.canActivate(contexto('GET'))).resolves.toBe(true);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rechaza escrituras cuando la suscripción está suspendida', async () => {
    findFirst.mockResolvedValue({ estado: 'suspendida' });
    await expect(guard.canActivate(contexto('POST'))).rejects.toMatchObject({
      status: 402,
    });
  });

  it('permite facturación y recuperación aunque la cuenta esté suspendida', async () => {
    await expect(guard.canActivate(contexto('POST', true))).resolves.toBe(true);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
