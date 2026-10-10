import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CurrentAuth } from '../../auth/auth.types';
import { PermisosGuard } from '../../auth/permisos.guard';
import { AdministracionController } from '../administracion.controller';

function caso(permisos: string[]) {
  const auth = {
    tenantId: 'empresa-ficticia',
    permisos: new Set(['acceso.por_vista', ...permisos]),
  } as CurrentAuth;
  const comprobantesService = { listar: jest.fn().mockResolvedValue([]) };
  const ctrl = Object.assign(
    Object.create(AdministracionController.prototype),
    { comprobantesService },
  ) as AdministracionController;
  const guard = new PermisosGuard(new Reflector());
  function consultar(ordenId?: string) {
    guard.canActivate({
      getHandler: () => ctrl.listarComprobantes,
      getClass: () => AdministracionController,
      switchToHttp: () => ({ getRequest: () => ({ auth }) }),
    } as never);
    return ctrl.listarComprobantes(
      auth,
      undefined,
      undefined,
      undefined,
      ordenId,
    );
  }
  return { auth, comprobantesService, consultar };
}
it('el permiso de facturar consulta comprobantes sólo de la OT seleccionada', async () => {
  const c = caso(['administracion.facturacion.gestionar']);
  await expect(c.consultar('ot-ficticia')).resolves.toEqual([]);
  expect(c.comprobantesService.listar).toHaveBeenCalledWith(
    c.auth,
    expect.objectContaining({ ordenId: 'ot-ficticia' }),
  );
});
it('el permiso fiscal no concede el listado general al omitir la OT', () => {
  const c = caso(['administracion.facturacion.gestionar']);
  expect(() => c.consultar()).toThrow(ForbiddenException);
  expect(() => c.consultar('')).toThrow(ForbiddenException);
  expect(c.comprobantesService.listar).not.toHaveBeenCalled();
});
it.each([
  'comercial.ordenes.gestionar',
  'produccion.tablero.ver',
  'administracion.facturacion.ver',
])('no amplía %s a la consulta de emisión', (permiso) => {
  expect(() => caso([permiso]).consultar('ot-ficticia')).toThrow(
    ForbiddenException,
  );
});
it('el permiso de comprobantes conserva la consulta global', async () => {
  await expect(
    caso(['administracion.comprobantes.ver']).consultar(),
  ).resolves.toEqual([]);
});
