import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { PublicacionAutomaticaInterceptor } from '../publicacion-automatica.interceptor';

it('conserva el propietario al eliminar un paso y espera la sincronización antes de responder', async () => {
  const orden: string[] = [];
  const prisma = { productoPasoExtra: { findFirst: jest.fn(async () => { orden.push('propietario'); return { productoId: 'producto' }; }) } };
  const recetas = { sincronizarPublicaciones: jest.fn(async () => { orden.push('publicado'); }) };
  const auth = { tenantId: 'cuenta', userId: 'actor' };
  const context = { getHandler: () => null, switchToHttp: () => ({ getRequest: () => ({ auth, params: { pasoExtraId: 'paso' } }) }) } as unknown as ExecutionContext;
  const interceptor = new PublicacionAutomaticaInterceptor({ get: () => ({ origen: 'pasoExtra', parametro: 'pasoExtraId' }) } as unknown as Reflector, prisma as never, recetas as never);
  const result = await interceptor.intercept(context, { handle: () => { orden.push('eliminado'); return of(undefined); } });
  await firstValueFrom(result);
  expect(orden).toEqual(['propietario', 'eliminado', 'publicado']);
  expect(prisma.productoPasoExtra.findFirst).toHaveBeenCalledWith({ where: { tenantId: 'cuenta', id: 'paso' }, select: { productoId: true } });
  expect(recetas.sincronizarPublicaciones).toHaveBeenCalledWith(auth, ['producto']);
});

it('no publica cuando el guardado es rechazado', async () => {
  const recetas = { sincronizarPublicaciones: jest.fn() };
  const context = { getHandler: () => null, switchToHttp: () => ({ getRequest: () => ({ auth: { tenantId: 'cuenta' }, params: { id: 'producto' } }) }) } as unknown as ExecutionContext;
  const interceptor = new PublicacionAutomaticaInterceptor({ get: () => ({ origen: 'producto', parametro: 'id' }) } as unknown as Reflector, {} as never, recetas as never);
  const error = new Error('Guardado rechazado');
  const result = await interceptor.intercept(context, { handle: () => throwError(() => error) });
  await expect(firstValueFrom(result)).rejects.toBe(error);
  expect(recetas.sincronizarPublicaciones).not.toHaveBeenCalled();
});
