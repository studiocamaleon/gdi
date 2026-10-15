import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermisosGuard } from '../../auth/permisos.guard';
import { OrdenesTrabajoController } from '../ordenes-trabajo.controller';
import { EntregaService } from '../entrega.service';
import type { CurrentAuth } from '../../auth/auth.types';

function autoriza(accion: keyof OrdenesTrabajoController, permisos: string[]) {
  return new PermisosGuard(new Reflector()).canActivate({
    getClass: () => OrdenesTrabajoController,
    getHandler: () => OrdenesTrabajoController.prototype[accion],
    switchToHttp: () => ({
      getRequest: () => ({
        auth: { tenantId: 'empresa-ficticia', permisos: new Set(permisos) },
      }),
    }),
  } as never);
}

describe('permisos de cobro y entrega en mostrador', () => {
  it('un vendedor puede escanear y entregar desde la OT, sin gestionar producción', () => {
    const permisos = [
      'acceso.por_vista',
      'comercial.ordenes.gestionar',
      'administracion.cobrar',
    ];
    expect(autoriza('escanear', permisos)).toBe(true);
    expect(autoriza('entregar', permisos)).toBe(true);
    expect(() => autoriza('revertirEntrega', permisos)).toThrow(
      ForbiddenException,
    );
  });
  it('sólo consultar la OT no permite entregarla', () => {
    expect(autoriza('escanear', ['comercial.ordenes.ver'])).toBe(true);
    expect(() => autoriza('entregar', ['comercial.ordenes.ver'])).toThrow(
      ForbiddenException,
    );
  });
  it('un permiso de producción no habilita pagos por el endpoint de entrega', async () => {
    const cobros = {
      create: jest.fn(),
      puedeRegistrarEnOrden: jest.fn().mockResolvedValue(true),
    };
    const prisma = {
      ordenTrabajo: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'orden-ficticia',
            numero: 'OT-2026-0001',
            estado: 'finalizada',
            total: 100,
            cobradoTotal: 0,
            createdAt: new Date(),
            items: [],
          }),
      },
    };
    const servicio = new EntregaService(
      prisma as never,
      cobros as never,
      {} as never,
    );
    const auth = {
      tenantId: 'empresa-ficticia',
      permisos: new Set(['produccion.gestionar']),
    } as CurrentAuth;
    const escaneo = await servicio.escanear(auth, 'OT-2026-0001');
    expect(escaneo.puedeCobrar).toBe(false);
    await expect(
      servicio.entregar(auth, 'orden-ficticia', {
        itemIds: [],
        cobro: {} as never,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(cobros.create).not.toHaveBeenCalled();
  });
});
