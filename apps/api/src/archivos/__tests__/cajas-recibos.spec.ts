import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccesoArchivo, ArchivosAccesoGuard } from '../archivos-acceso.guard';
class Recibos {
  @AccesoArchivo({ origen: 'archivo', accion: 'leer' }) descargar() {}
  @AccesoArchivo({ origen: 'query', accion: 'leer' }) listar() {}
}
describe('El archivo de un recibo respeta las cajas asignadas', () => {
  const permitida = randomUUID(),
    ajena = randomUUID(),
    cobroId = randomUUID();
  function caso(
    cuenta = permitida,
    modo: 'descargar' | 'listar' = 'descargar',
    entidadId: string | undefined = cobroId,
  ) {
    const db = {
      archivo: {
        findFirst: jest.fn().mockResolvedValue({ scope: 'COBRO', cobroId }),
      },
      membership: {
        findFirst: jest.fn().mockResolvedValue({
          cuentasRestringidas: true,
          cuentasOperablesIds: [permitida],
          cuentasDestinoIds: [ajena],
        }),
      },
      cobro: {
        findFirst: jest.fn().mockResolvedValue({ cuentaDestinoId: cuenta }),
      },
    };
    const auth = {
      tenantId: randomUUID(),
      userId: randomUUID(),
      permisos: new Set(['administracion.cobrar.ver']),
    };
    const req = {
      auth,
      params: { id: randomUUID() },
      query: { scope: 'COBRO', entidadId },
    };
    const ctx = {
      getHandler: () => Recibos.prototype[modo],
      switchToHttp: () => ({ getRequest: () => req }),
    } as ExecutionContext;
    return {
      guard: new ArchivosAccesoGuard(new Reflector(), db as never),
      ctx,
      db,
      auth,
    };
  }
  it('permite descargar de la caja propia y acota la consulta a su empresa', async () => {
    const c = caso();
    expect(await c.guard.canActivate(c.ctx)).toBe(true);
    expect(c.db.cobro.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: cobroId, tenantId: c.auth.tenantId },
      }),
    );
  });
  it('tener un destino de transferencia no abre sus archivos', async () => {
    const c = caso(ajena);
    await expect(c.guard.canActivate(c.ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('impide listar indiscriminadamente todos los recibos con scope COBRO', async () => {
    const c = caso(permitida, 'listar');
    const ctx = {
      getHandler: () => Recibos.prototype.listar,
      switchToHttp: () => ({
        getRequest: () => ({
          auth: c.auth,
          params: {},
          query: { scope: 'COBRO' },
        }),
      }),
    } as ExecutionContext;
    await expect(c.guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(c.db.cobro.findFirst).not.toHaveBeenCalled();
  });
});

class Adjuntos {
  @AccesoArchivo({ origen: 'query', accion: 'leer' }) leer() {}
  @AccesoArchivo({ origen: 'body', accion: 'escribir' }) escribir() {}
}
describe('Los adjuntos no abren vistas comerciales o productivas denegadas', () => {
  function caso(
    scope: string,
    permisos: string[],
    modo: 'leer' | 'escribir' = 'leer',
    numero: string | null = null,
  ) {
    const auth = {
      tenantId: randomUUID(),
      userId: randomUUID(),
      permisos: new Set(permisos),
    };
    const entidadId = randomUUID();
    const req = {
      auth,
      params: {},
      query: { scope, entidadId },
      body: { scope, entidadId },
    };
    const db = {
      cotizacion: { findFirst: jest.fn().mockResolvedValue({ numero }) },
    };
    const ctx = {
      getHandler: () => Adjuntos.prototype[modo],
      switchToHttp: () => ({ getRequest: () => req }),
    } as ExecutionContext;
    return {
      guard: new ArchivosAccesoGuard(new Reflector(), db as never),
      ctx,
      db,
      auth,
      entidadId,
    };
  }
  it('permite el snapshot de una orden al vendedor sin acceso a presupuestos', async () => {
    const c = caso('COTIZACION', ['comercial.ordenes.ver']);
    expect(await c.guard.canActivate(c.ctx)).toBe(true);
    expect(c.db.cotizacion.findFirst).toHaveBeenCalledWith({
      where: { id: c.entidadId, tenantId: c.auth.tenantId },
      select: { numero: true },
    });
  });
  it('deniega archivos de un presupuesto formal al vendedor de sólo órdenes', async () => {
    const c = caso('COTIZACION', ['comercial.ordenes.ver'], 'leer', 'P-TEST-1');
    await expect(c.guard.canActivate(c.ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('requiere la vista productiva además de ejecutar para subir un archivo de OT', async () => {
    const c = caso('ORDEN_ITEM', ['produccion.ejecutar'], 'escribir');
    await expect(c.guard.canActivate(c.ctx)).rejects.toThrow(
      ForbiddenException,
    );
    c.auth.permisos.add('produccion.tablero.ver');
    expect(await c.guard.canActivate(c.ctx)).toBe(true);
  });
});
