import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolSistema } from '@prisma/client';

import {
  MODULOS,
  PERMISOS,
  PERMISOS_TRANSVERSALES,
  ROLES_PREDEFINIDOS,
  esPermisoValido,
  expandir,
  permisosDeRolBase,
  todosLosPermisos,
} from '../permisos';
import { PermisosGuard } from '../permisos.guard';
import { PERMISO_KEY, SOLO_AUTENTICADO_KEY } from '../permiso.decorator';
import { SIN_TENANT_KEY } from '../../common/sin-tenant.decorator';
import type { CurrentAuth } from '../auth.types';

describe('catálogo de permisos', () => {
  it('tiene ver y gestionar por cada módulo, más los transversales', () => {
    expect(PERMISOS).toHaveLength(
      MODULOS.length * 2 + PERMISOS_TRANSVERSALES.length,
    );
    expect(esPermisoValido('costos.gestionar')).toBe(true);
    expect(esPermisoValido('costos.borrar')).toBe(false);
  });

  describe('expandir', () => {
    it('gestionar arrastra su ver', () => {
      const efectivos = expandir(['costos.gestionar']);
      expect(efectivos.has('costos.ver')).toBe(true);
    });

    it('ver no arrastra gestionar', () => {
      expect(expandir(['costos.ver']).has('costos.gestionar')).toBe(false);
    });

    /**
     * Una clave que se retira del catálogo no puede tumbar al que la tenía
     * guardada: se ignora y el resto de sus permisos siguen valiendo.
     */
    it('ignora claves que ya no existen', () => {
      const efectivos = expandir(['modulo_viejo.ver', 'reportes.ver']);
      expect([...efectivos]).toEqual(['reportes.ver']);
    });
  });

  describe('roles predefinidos', () => {
    it('todos usan claves del catálogo', () => {
      for (const rol of ROLES_PREDEFINIDOS) {
        for (const permiso of rol.permisos) {
          expect(esPermisoValido(permiso)).toBe(true);
        }
      }
    });

    it('el administrador tiene todo', () => {
      const admin = ROLES_PREDEFINIDOS.find(
        (r) => r.codigo === 'administrador',
      );
      expect(admin!.permisos).toEqual(todosLosPermisos());
    });

    /** El motivo de que el permiso de márgenes exista aparte. */
    it('el vendedor cotiza pero no ve márgenes', () => {
      const efectivos = expandir(
        ROLES_PREDEFINIDOS.find((r) => r.codigo === 'vendedor')!.permisos,
      );
      expect(efectivos.has('comercial.gestionar')).toBe(true);
      expect(efectivos.has('finanzas.ver_margenes')).toBe(false);
      expect(efectivos.has('costos.ver')).toBe(false);
    });

    /** El agujero que cierra el módulo: el operario no ve la plata. */
    it('el operario sólo entra a producción', () => {
      const efectivos = expandir(
        ROLES_PREDEFINIDOS.find((r) => r.codigo === 'operario')!.permisos,
      );
      expect(efectivos.has('produccion.gestionar')).toBe(true);
      for (const modulo of [
        'costos',
        'administracion',
        'configuracion',
        'reportes',
      ]) {
        expect(efectivos.has(`${modulo}.ver`)).toBe(false);
      }
    });

    /**
     * El home es de todos. `panel.ver` significaba otra cosa cuando el Panel
     * general ERA los reportes —por eso el operario no lo tenía y entraba a una
     * pantalla que no podía abrir—; hoy gatea una pantalla de inicio y nada más.
     */
    it('todos los roles entran al Panel general', () => {
      for (const rol of ROLES_PREDEFINIDOS) {
        expect(expandir(rol.permisos).has('panel.ver')).toBe(true);
      }
    });
  });

  describe('permisosDeRolBase (fallback del enum)', () => {
    it('ADMINISTRADOR mantiene todo', () => {
      expect(permisosDeRolBase(RolSistema.ADMINISTRADOR)).toEqual(
        todosLosPermisos(),
      );
    });

    /** Nadie pierde acceso que ya tenía por no haber sido backfilleado. */
    it('SUPERVISOR conserva lo que podía hacer', () => {
      const efectivos = expandir(permisosDeRolBase(RolSistema.SUPERVISOR));
      expect(efectivos.has('produccion.gestionar')).toBe(true);
      expect(efectivos.has('costos.ver')).toBe(true);
    });
  });
});

/** Contexto mínimo: al guard sólo le importan los metadatos y `request.auth`. */
function contexto(auth?: CurrentAuth): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ auth }) }),
    getHandler: () => function handler() {},
    getClass: () => class Controlador {},
  } as unknown as ExecutionContext;
}

function guardCon(metadatos: Record<string, unknown>) {
  const reflector = {
    getAllAndOverride: (key: string) => metadatos[key],
  } as unknown as Reflector;
  return new PermisosGuard(reflector);
}

const AUTH: CurrentAuth = {
  userId: 'u1',
  sessionId: 's1',
  tenantId: 't1',
  membershipId: 'm1',
  role: RolSistema.OPERADOR,
  email: 'operario@imprenta.test',
  permisos: expandir(['produccion.gestionar']),
};

describe('PermisosGuard', () => {
  it('deja pasar cuando el permiso está', () => {
    const guard = guardCon({ [PERMISO_KEY]: 'produccion.ver' });
    expect(guard.canActivate(contexto(AUTH))).toBe(true);
  });

  it('rechaza cuando no está', () => {
    const guard = guardCon({ [PERMISO_KEY]: 'costos.ver' });
    expect(() => guard.canActivate(contexto(AUTH))).toThrow(ForbiddenException);
  });

  /**
   * El corazón del módulo: antes, un endpoint sin anotar quedaba abierto para
   * cualquiera. Ahora no pasa nadie hasta que alguien declare qué pide.
   */
  it('DENIEGA por defecto: sin anotación no se entra', () => {
    const guard = guardCon({});
    expect(() => guard.canActivate(contexto(AUTH))).toThrow(ForbiddenException);
  });

  it('@SoloAutenticado deja pasar sin permisos', () => {
    const guard = guardCon({ [SOLO_AUTENTICADO_KEY]: true });
    expect(guard.canActivate(contexto(AUTH))).toBe(true);
  });

  /**
   * Varios permisos = alcanza con cualquiera. Es lo que deja que el cobro lo
   * registren dos roles distintos —el Administrativo por la caja, el Vendedor
   * por la seña— sin darle a ninguno el permiso del otro.
   */
  describe('permisos alternativos (OR)', () => {
    it('alcanza con tener uno de los declarados', () => {
      const guard = guardCon({
        [PERMISO_KEY]: ['administracion.gestionar', 'produccion.ver'],
      });
      expect(guard.canActivate(contexto(AUTH))).toBe(true);
    });

    it('rechaza si no tiene ninguno', () => {
      const guard = guardCon({
        [PERMISO_KEY]: ['administracion.gestionar', 'costos.ver'],
      });
      expect(() => guard.canActivate(contexto(AUTH))).toThrow(
        ForbiddenException,
      );
    });

    /** La forma vieja (una sola clave, sin array) tiene que seguir andando. */
    it('sigue aceptando un permiso suelto', () => {
      const guard = guardCon({ [PERMISO_KEY]: 'produccion.gestionar' });
      expect(guard.canActivate(contexto(AUTH))).toBe(true);
    });

    it('una lista vacía deniega, como no declarar nada', () => {
      const guard = guardCon({ [PERMISO_KEY]: [] });
      expect(() => guard.canActivate(contexto(AUTH))).toThrow(
        ForbiddenException,
      );
    });
  });

  it('no se mete con el control plane (@SinTenant)', () => {
    const guard = guardCon({ [SIN_TENANT_KEY]: true });
    expect(guard.canActivate(contexto(undefined))).toBe(true);
  });

  it('una ruta pública sin auth pasa (ya cortó AuthGuard)', () => {
    const guard = guardCon({});
    expect(guard.canActivate(contexto(undefined))).toBe(true);
  });
});
