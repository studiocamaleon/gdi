import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../roles.guard';
import { Roles } from '../roles.decorator';
import { Permiso } from '../permiso.decorator';
import { PermisosGuard } from '../permisos.guard';
import { expandir } from '../permisos';
import { CampanasController } from '../../campanas/campanas.controller';
import { PresupuestosController } from '../../presupuestos/presupuestos.controller';
import { ReportesController } from '../../reportes/reportes.controller';
import { ProductosServiciosController } from '../../productos-servicios/productos-servicios.controller';
import { UsuariosController } from '../../usuarios/usuarios.controller';
import { PERMISO_KEY } from '../permiso.decorator';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';

function ruta(clase: { prototype: object }, ruta: string, metodo = 0) {
  return Object.getOwnPropertyNames(clase.prototype)
    .map((k) => (clase.prototype as Record<string, object>)[k])
    .find(
      (fn) =>
        Reflect.getMetadata(PATH_METADATA, fn) === ruta &&
        Reflect.getMetadata(METHOD_METADATA, fn) === metodo,
    )!;
}
function pasa(clase: object, handler: object, permisos: string[]) {
  expect(handler).toBeDefined();
  const auth = { tenantId: 'empresa-ficticia', permisos: expandir(permisos) };
  return new PermisosGuard(new Reflector()).canActivate({
    getClass: () => clase,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
  } as ExecutionContext);
}

describe('Permisos de vistas sin apertura de pantallas hermanas', () => {
  it('presupuestos no habilita campañas ni el permiso Comercial completo', () => {
    const p = ['acceso.por_vista', 'comercial.presupuestos.gestionar'];
    expect(expandir(p).has('comercial.ver')).toBe(false);
    expect(
      pasa(PresupuestosController, ruta(PresupuestosController, '/'), p),
    ).toBe(true);
    expect(() =>
      pasa(CampanasController, ruta(CampanasController, '/'), p),
    ).toThrow(ForbiddenException);
  });
  it('sólo Comercial en análisis no habilita Finanzas ni Resumen ejecutivo', () => {
    const p = ['acceso.por_vista', 'reportes.comercial.ver'];
    expect(
      pasa(ReportesController, ruta(ReportesController, 'comercial'), p),
    ).toBe(true);
    for (const r of ['resumen', 'finanzas'])
      expect(() =>
        pasa(ReportesController, ruta(ReportesController, r), p),
      ).toThrow(ForbiddenException);
  });
  it('ver Usuarios no permite crear ni editar roles', () => {
    const p = ['acceso.por_vista', 'configuracion.usuarios.ver'];
    expect(pasa(UsuariosController, ruta(UsuariosController, '/'), p)).toBe(
      true,
    );
    expect(() =>
      pasa(UsuariosController, ruta(UsuariosController, 'roles', 1), p),
    ).toThrow(ForbiddenException);
  });
  it('las acciones antiguas no reabren vistas expresamente deshabilitadas', () => {
    const p = expandir([
      'acceso.por_vista',
      'comercial.aprobar_descuento',
      'administracion.configurar',
    ]);
    expect(p.has('crm.cupones.gestionar')).toBe(false);
    expect(p.has('administracion.gastos.ver')).toBe(false);
  });
  it('el cotizador tiene consultas auxiliares sin abrir la administración del catálogo', () => {
    const p = ['acceso.por_vista', 'comercial.ordenes.gestionar'];
    for (const endpoint of [
      'cotizacion-productos',
      'cotizacion-productos/:id',
      'cotizacion-cargos',
      'familias',
    ])
      expect(
        pasa(
          ProductosServiciosController,
          ruta(ProductosServiciosController, endpoint),
          p,
        ),
      ).toBe(true);
    expect(() =>
      pasa(
        ProductosServiciosController,
        ruta(ProductosServiciosController, 'productos'),
        p,
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      pasa(
        ProductosServiciosController,
        ruta(ProductosServiciosController, 'productos', 1),
        p,
      ),
    ).toThrow(ForbiddenException);
  });
  it('convertir presupuesto requiere poder crear órdenes', () => {
    const handler = ruta(PresupuestosController, ':id/convertir', 1);
    expect(() =>
      pasa(PresupuestosController, handler, [
        'acceso.por_vista',
        'comercial.presupuestos.gestionar',
      ]),
    ).toThrow(ForbiddenException);
    expect(
      pasa(PresupuestosController, handler, [
        'acceso.por_vista',
        'comercial.presupuestos.gestionar',
        'comercial.ordenes.gestionar',
      ]),
    ).toBe(true);
  });
  it('los roles históricos conservan las lecturas y escrituras de su sección', () => {
    const p = expandir(['comercial.gestionar']);
    expect(p.has('comercial.presupuestos.gestionar')).toBe(true);
    expect(p.has('comercial.campanas.gestionar')).toBe(true);
    expect(p.has('configuracion.usuarios.gestionar')).toBe(false);
  });
  it('el guard comprueba el permiso de Usuarios y no sólo el enum administrador', () => {
    const handler = ruta(UsuariosController, 'roles', 1);
    expect(Reflect.getMetadata(PERMISO_KEY, handler)).toEqual([
      'configuracion.usuarios.gestionar',
    ]);
  });
});

@Roles('ADMINISTRADOR')
class VistaDelegada {
  @Permiso('configuracion.empresa.gestionar') guardar() {}
  sinPermisoGranular() {}
}
describe('Delegación explícita sin depender del nombre histórico del rol', () => {
  const reflector = new Reflector();
  function contexto(
    metodo: 'guardar' | 'sinPermisoGranular',
    permisos: string[],
  ) {
    const auth = { role: 'OPERADOR', permisos: expandir(permisos) };
    return {
      getClass: () => VistaDelegada,
      getHandler: () => VistaDelegada.prototype[metodo],
      switchToHttp: () => ({ getRequest: () => ({ auth }) }),
    } as ExecutionContext;
  }
  it('permite al operador la acción delegada, pero no una acción no concedida', () => {
    const c = contexto('guardar', [
      'acceso.por_vista',
      'configuracion.empresa.gestionar',
    ]);
    expect(new RolesGuard(reflector).canActivate(c)).toBe(true);
    expect(new PermisosGuard(reflector).canActivate(c)).toBe(true);
    const sin = contexto('guardar', [
      'acceso.por_vista',
      'configuracion.empresa.ver',
    ]);
    expect(new RolesGuard(reflector).canActivate(sin)).toBe(true);
    expect(() => new PermisosGuard(reflector).canActivate(sin)).toThrow(
      ForbiddenException,
    );
  });
  it('no relaja una ruta sólo protegida por rol ni los roles históricos', () => {
    expect(() =>
      new RolesGuard(reflector).canActivate(
        contexto('sinPermisoGranular', ['acceso.por_vista']),
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      new RolesGuard(reflector).canActivate(
        contexto('guardar', ['configuracion.gestionar']),
      ),
    ).toThrow(ForbiddenException);
  });
});
