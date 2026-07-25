import { BadRequestException, ConflictException } from '@nestjs/common';
import { RolSistema } from '@prisma/client';

import { UsuariosService } from '../usuarios.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SessionCacheService } from '../../auth/session-cache.service';
import type { SuscripcionesService } from '../../suscripciones/suscripciones.service';
import type { CurrentAuth } from '../../auth/auth.types';

/**
 * Las reglas del editor de roles que no se pueden romper.
 *
 * La que importa es la última: sin ella, sacarle la configuración al único rol
 * que la tiene deja al tenant sin nadie que pueda revertirlo, y hay que entrar
 * por la base a arreglarlo.
 */

const AUTH: CurrentAuth = {
  userId: 'u1',
  sessionId: 's1',
  tenantId: 't1',
  membershipId: 'm1',
  role: RolSistema.ADMINISTRADOR,
  email: 'admin@imprenta.test',
};

/** Lo que le llega a `rol.create`: alcanza con lo que los tests miran. */
type DatosRol = {
  permisos: string[];
  codigo: string | null;
  esDelSistema: boolean;
};

type Opciones = {
  rol?: Record<string, unknown> | null;
  /** Cuántas OTRAS membresías activas tienen configuracion.gestionar. */
  otrosConLlaves?: number;
  nombreEnUso?: boolean;
};

function armar({
  rol = null,
  otrosConLlaves = 1,
  nombreEnUso = false,
}: Opciones = {}) {
  const rolUpdate = jest.fn().mockResolvedValue({});
  const rolCreate = jest
    .fn<Promise<unknown>, [{ data: DatosRol }]>()
    .mockImplementation(({ data }) =>
      Promise.resolve({ id: 'nuevo', ...data }),
    );
  const membershipUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
  const prisma = {
    rol: {
      // Un solo findFirst para dos preguntas: `where.nombre` es la de "¿ya
      // hay un rol con este nombre?"; sin él, la de "traeme el rol".
      findFirst: jest
        .fn<Promise<unknown>, [{ where?: { nombre?: unknown } }]>()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            where?.nombre ? (nombreEnUso ? { id: 'otro' } : null) : rol,
          ),
        ),
      create: rolCreate,
      update: rolUpdate,
      delete: jest.fn().mockResolvedValue({}),
    },
    membership: {
      count: jest.fn().mockResolvedValue(otrosConLlaves),
      updateMany: membershipUpdateMany,
    },
    // El registro de auditoría es best-effort: sin este mock los tests pasan
    // igual (por diseño), pero llenan la salida de errores tragados.
    eventoAcceso: { create: jest.fn().mockResolvedValue({}) },
    $transaction: (fn: (tx: unknown) => unknown) =>
      Promise.resolve(
        fn({
          rol: { update: rolUpdate },
          membership: { updateMany: membershipUpdateMany },
        }),
      ),
  } as unknown as PrismaService;

  const invalidarTenant = jest.fn();
  const service = new UsuariosService(
    prisma,
    { invalidarTenant } as unknown as SessionCacheService,
    {} as unknown as SuscripcionesService,
  );
  return {
    service,
    rolCreate,
    rolUpdate,
    membershipUpdateMany,
    invalidarTenant,
  };
}

const A_MEDIDA = {
  id: 'r1',
  tenantId: 't1',
  codigo: null,
  nombre: 'Encargado de depósito',
  esDelSistema: false,
  permisos: ['inventario.gestionar'],
};

describe('crear rol', () => {
  it('guarda sólo claves del catálogo', async () => {
    const { service, rolCreate } = armar();
    await service.crearRol(AUTH, {
      nombre: 'Depósito',
      permisos: ['inventario.gestionar', 'inventario.borrar', 'inventado.ver'],
    });
    expect(rolCreate.mock.calls[0][0].data.permisos).toEqual([
      'inventario.gestionar',
    ]);
  });

  /** Dos formas de decir lo mismo terminan en dos matrices que se ven distintas. */
  it('descarta el ver que ya arrastra su gestionar', async () => {
    const { service, rolCreate } = armar();
    await service.crearRol(AUTH, {
      nombre: 'Depósito',
      permisos: ['inventario.ver', 'inventario.gestionar', 'reportes.ver'],
    });
    expect(rolCreate.mock.calls[0][0].data.permisos.sort()).toEqual([
      'inventario.gestionar',
      'reportes.ver',
    ]);
  });

  it('no deja dos roles con el mismo nombre', async () => {
    const { service } = armar({ nombreEnUso: true });
    await expect(
      service.crearRol(AUTH, { nombre: 'Vendedor', permisos: ['reportes.ver'] }),
    ).rejects.toThrow(ConflictException);
  });

  it('nace sin código: los códigos son de los predefinidos de Grafo', async () => {
    const { service, rolCreate } = armar();
    await service.crearRol(AUTH, {
      nombre: 'Depósito',
      permisos: ['reportes.ver'],
    });
    expect(rolCreate.mock.calls[0][0].data.codigo).toBeNull();
    expect(rolCreate.mock.calls[0][0].data.esDelSistema).toBe(false);
  });
});

describe('editar rol', () => {
  it('no renombra uno de fábrica', async () => {
    const { service } = armar({
      rol: {
        ...A_MEDIDA,
        codigo: 'vendedor',
        esDelSistema: true,
        nombre: 'Vendedor',
      },
    });
    await expect(
      service.editarRol(AUTH, 'r1', { nombre: 'Otra cosa' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('sí le ajusta los permisos a uno de fábrica', async () => {
    const { service, rolUpdate } = armar({
      rol: {
        ...A_MEDIDA,
        codigo: 'vendedor',
        esDelSistema: true,
        nombre: 'Vendedor',
      },
    });
    await service.editarRol(AUTH, 'r1', { permisos: ['comercial.gestionar'] });
    expect(rolUpdate).toHaveBeenCalled();
  });

  /**
   * El enum sigue vivo y lo leen los endpoints con @Roles: si el rol gana
   * configuración, sus miembros pasan a ADMINISTRADOR. Sin esto, cambiar
   * permisos arreglaba la mitad del acceso.
   */
  it('mueve el rol base de sus miembros al cambiar permisos', async () => {
    const { service, membershipUpdateMany } = armar({ rol: A_MEDIDA });
    await service.editarRol(AUTH, 'r1', {
      permisos: ['configuracion.gestionar'],
    });
    expect(membershipUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { rol: RolSistema.ADMINISTRADOR },
      }),
    );
  });

  it('el cambio se siente ya: invalida las sesiones del tenant', async () => {
    const { service, invalidarTenant } = armar({ rol: A_MEDIDA });
    await service.editarRol(AUTH, 'r1', { permisos: ['reportes.ver'] });
    expect(invalidarTenant).toHaveBeenCalledWith('t1');
  });

  describe('el cerrojo de la configuración', () => {
    it('deja sacarla si otro rol la conserva', async () => {
      const { service } = armar({
        rol: { ...A_MEDIDA, permisos: ['configuracion.gestionar'] },
        otrosConLlaves: 1,
      });
      await expect(
        service.editarRol(AUTH, 'r1', { permisos: ['reportes.ver'] }),
      ).resolves.toEqual({ ok: true });
    });

    it('NO deja al tenant sin nadie que pueda administrarlo', async () => {
      const { service } = armar({
        rol: { ...A_MEDIDA, permisos: ['configuracion.gestionar'] },
        otrosConLlaves: 0,
      });
      await expect(
        service.editarRol(AUTH, 'r1', { permisos: ['reportes.ver'] }),
      ).rejects.toThrow(/nadie podría administrar/i);
    });
  });
});

describe('eliminar rol', () => {
  it('no borra uno de fábrica', async () => {
    const { service } = armar({
      rol: {
        ...A_MEDIDA,
        esDelSistema: true,
        _count: { memberships: 0 },
      },
    });
    await expect(service.eliminarRol(AUTH, 'r1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('con usuarios adentro exige decir a dónde van', async () => {
    const { service } = armar({
      rol: { ...A_MEDIDA, _count: { memberships: 3 } },
    });
    await expect(service.eliminarRol(AUTH, 'r1')).rejects.toThrow(
      /Elegí a qué rol pasan/,
    );
  });

  it('vacío se borra sin preguntar', async () => {
    const { service } = armar({
      rol: { ...A_MEDIDA, _count: { memberships: 0 } },
    });
    await expect(service.eliminarRol(AUTH, 'r1')).resolves.toEqual({
      ok: true,
    });
  });
});
