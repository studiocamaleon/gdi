import { ForbiddenException } from '@nestjs/common';
import type { CurrentAuth } from '../../auth/auth.types';
import { AdministracionController } from '../administracion.controller';
import { PermisosGuard } from '../../auth/permisos.guard';
import { Reflector } from '@nestjs/core';

describe('Consulta comercial de cobros sin acceso al módulo Cobrar', () => {
  function caso(permisos: string[]) {
    const auth = {
      tenantId: 'empresa-ficticia',
      permisos: new Set(['acceso.por_vista', ...permisos]),
    } as CurrentAuth;
    const cobros = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ ordenId: 'orden-ficticia' }),
    };
    const recibos = { urlPublica: jest.fn().mockResolvedValue('/c/ficticio') };
    const ctrl = new AdministracionController(
      {} as never,
      cobros as never,
      recibos as never,
      ...(Array(11).fill({}) as [
        never,
        never,
        never,
        never,
        never,
        never,
        never,
        never,
        never,
        never,
        never,
      ]),
    );
    const guard = new PermisosGuard(new Reflector());
    function consultar(ordenId?: string) {
      guard.canActivate({
        getHandler: () => ctrl.cobros,
        getClass: () => AdministracionController,
        switchToHttp: () => ({ getRequest: () => ({ auth }) }),
      } as never);
      return ctrl.cobros(auth, ordenId);
    }
    return { auth, cobros, recibos, ctrl, consultar };
  }
  it('permite al creador de órdenes consultar los pagos de una orden específica', async () => {
    const c = caso(['comercial.ordenes.gestionar']);
    await expect(c.consultar('orden-ficticia')).resolves.toEqual([]);
    expect(c.cobros.findAll).toHaveBeenCalledWith(c.auth, {
      ordenId: 'orden-ficticia',
    });
  });
  it('no permite convertir ese acceso en un listado global omitiendo la orden', () => {
    const c = caso(['comercial.ordenes.gestionar']);
    expect(() => c.consultar()).toThrow(ForbiddenException);
    expect(() => c.consultar('')).toThrow(ForbiddenException);
    expect(c.cobros.findAll).not.toHaveBeenCalled();
  });
  it('un rol de presupuestos no obtiene los cobros indicando una orden', () => {
    const c = caso(['comercial.presupuestos.ver']);
    expect(() => c.consultar('orden-ficticia')).toThrow(ForbiddenException);
    expect(c.cobros.findAll).not.toHaveBeenCalled();
  });
  it('Cobrar conserva su consulta global', async () => {
    await expect(
      caso(['administracion.cobrar.ver']).consultar(),
    ).resolves.toEqual([]);
  });
  it('el vendedor puede abrir un recibo de la orden de una caja operable', async () => {
    const c = caso(['comercial.ordenes.ver', 'administracion.cobrar']);
    await expect(
      c.ctrl.enlaceRecibo(c.auth, 'recibo-ficticio'),
    ).resolves.toEqual({ url: '/c/ficticio' });
    expect(c.cobros.findOne).toHaveBeenCalledWith(c.auth, 'recibo-ficticio');
  });
  it('no permite al vendedor abrir recibos ajenos a una orden ni sin acceso a órdenes', async () => {
    for (const permisos of [
      ['administracion.cobrar'],
      ['administracion.cobrar', 'comercial.ordenes.ver'],
    ]) {
      const c = caso(permisos);
      c.cobros.findOne.mockResolvedValue({ ordenId: null } as never);
      await expect(
        c.ctrl.enlaceRecibo(c.auth, 'recibo-ficticio'),
      ).rejects.toThrow(ForbiddenException);
      expect(c.recibos.urlPublica).not.toHaveBeenCalled();
    }
  });
  it('conserva el rechazo del servicio ante una cuenta fuera de alcance', async () => {
    const c = caso(['administracion.cobrar', 'comercial.ordenes.ver']);
    c.cobros.findOne.mockRejectedValue(new ForbiddenException());
    await expect(
      c.ctrl.enlaceRecibo(c.auth, 'recibo-ficticio'),
    ).rejects.toThrow(ForbiddenException);
    expect(c.recibos.urlPublica).not.toHaveBeenCalled();
  });
});
