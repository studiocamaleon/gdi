import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permiso, SoloAutenticado } from '../permiso.decorator';
import { PermisosGuard } from '../permisos.guard';
import type { CurrentAuth } from '../auth.types';

@SoloAutenticado()
class LecturaCompartida {
  leer() {}

  @Permiso('configuracion.gestionar')
  guardar() {}

  @Permiso()
  incompleto() {}
}

@Permiso('configuracion.gestionar')
class Configuracion {
  guardar() {}

  @SoloAutenticado()
  sesion() {}

  @Permiso('crm.ver')
  clientes() {}
}

@SoloAutenticado()
@Permiso('configuracion.gestionar')
class DeclaracionAmbigua {
  heredado() {}

  @SoloAutenticado()
  @Permiso('configuracion.gestionar')
  directo() {}
}

function permitir(controlador: object, metodo: string, permisos: string[]) {
  const clase = controlador as { prototype: Record<string, unknown> };
  const auth = { permisos: new Set(permisos) } as CurrentAuth;
  const contexto = {
    getClass: () => controlador,
    getHandler: () => clase.prototype[metodo],
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
  } as unknown as ExecutionContext;
  return new PermisosGuard(new Reflector()).canActivate(contexto);
}

describe('La autorización específica de una ruta prevalece sobre su controlador', () => {
  it('no hereda el acceso general cuando la escritura pide un permiso', () => {
    expect(() => permitir(LecturaCompartida, 'guardar', [])).toThrow(
      ForbiddenException,
    );
  });

  it('mantiene la escritura de quien sí tiene el permiso', () => {
    expect(
      permitir(LecturaCompartida, 'guardar', ['configuracion.gestionar']),
    ).toBe(true);
  });

  it('mantiene las lecturas compartidas sin permisos de configuración', () => {
    expect(permitir(LecturaCompartida, 'leer', [])).toBe(true);
  });

  it('un permiso vacío no se convierte en acceso general por herencia', () => {
    expect(() => permitir(LecturaCompartida, 'incompleto', [])).toThrow(
      ForbiddenException,
    );
  });

  it('permite una excepción explícita de sesión en el método', () => {
    expect(permitir(Configuracion, 'sesion', [])).toBe(true);
  });

  it('no aplica el permiso general en lugar del específico del método', () => {
    expect(() =>
      permitir(Configuracion, 'clientes', ['configuracion.gestionar']),
    ).toThrow(ForbiddenException);
    expect(permitir(Configuracion, 'clientes', ['crm.ver'])).toBe(true);
  });

  it.each(['heredado', 'directo'])(
    'ante dos reglas en el mismo nivel exige el permiso (%s)',
    (metodo) => {
      expect(() => permitir(DeclaracionAmbigua, metodo, [])).toThrow(
        ForbiddenException,
      );
      expect(
        permitir(DeclaracionAmbigua, metodo, ['configuracion.gestionar']),
      ).toBe(true);
    },
  );
});
