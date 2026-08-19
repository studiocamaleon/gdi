import { ConflictException, ForbiddenException } from '@nestjs/common';

import type { CurrentAuth } from '../../auth/auth.types';
import {
  alcanceTableroProduccionDe,
  OrdenesTrabajoService,
  pasosVisiblesParaOperario,
} from '../ordenes-trabajo.service';

const authCon = (permisos: string[]): CurrentAuth =>
  ({
    userId: 'usuario-1',
    sessionId: 'sesion-1',
    tenantId: 'tenant-1',
    membershipId: 'membership-1',
    role: 'OPERADOR',
    email: 'persona@ejemplo.com',
    permisos: new Set(permisos),
  }) as CurrentAuth;

function servicioVacio() {
  return Object.create(
    OrdenesTrabajoService.prototype,
  ) as OrdenesTrabajoService;
}

describe('alcance seguro del Tablero de producción', () => {
  it('el operario puede reclamar la frontera libre pero no ve pasos futuros ni ajenos', () => {
    const pasos = [
      {
        id: 'hecho',
        indice: 0,
        estado: 'hecho',
        mesaEsMia: false,
        mesaUsuarioNombre: null,
        tramoAbierto: null,
      },
      {
        id: 'frontera',
        indice: 1,
        estado: 'pendiente',
        mesaEsMia: false,
        mesaUsuarioNombre: null,
        tramoAbierto: null,
      },
      {
        id: 'futuro',
        indice: 2,
        estado: 'pendiente',
        mesaEsMia: false,
        mesaUsuarioNombre: null,
        tramoAbierto: null,
      },
      {
        id: 'ajeno',
        indice: 3,
        estado: 'pendiente',
        mesaEsMia: false,
        mesaUsuarioNombre: 'Otra persona',
        tramoAbierto: null,
      },
    ];

    expect(pasosVisiblesParaOperario(pasos).map((paso) => paso.id)).toEqual([
      'frontera',
    ]);
  });

  it('todos los perfiles comparten el tablero completo', () => {
    for (const permisos of [
      ['comercial.gestionar', 'produccion.ver'],
      ['produccion.ver', 'produccion.ejecutar'],
      ['produccion.gestionar', 'comercial.ver'],
    ]) {
      expect(alcanceTableroProduccionDe(authCon(permisos))).toBe('completo');
    }
  });

  it('un vendedor sin empleado vinculado igualmente recibe el tablero global', async () => {
    const ordenFindMany = jest.fn().mockResolvedValue([]);
    const service = servicioVacio() as unknown as {
      prisma: unknown;
      reconciliarTramosVencidos: () => Promise<void>;
      backfillPasosTablero: () => Promise<void>;
      tecnologiaPorMaquinaDeItems: () => Promise<Map<string, string | null>>;
      tablero: OrdenesTrabajoService['tablero'];
    };
    service.prisma = {
      ordenTrabajo: { findMany: ordenFindMany },
    };
    service.reconciliarTramosVencidos = jest.fn().mockResolvedValue(undefined);
    service.backfillPasosTablero = jest.fn().mockResolvedValue(undefined);
    service.tecnologiaPorMaquinaDeItems = jest.fn().mockResolvedValue(new Map());

    const respuesta = await service.tablero(
      authCon(['comercial.ver', 'comercial.gestionar', 'produccion.ver']),
    );

    expect(respuesta).toMatchObject({
      items: [],
      alcance: 'completo',
      puedeGestionar: false,
      vendedorSinVinculo: false,
    });
    expect(ordenFindMany).toHaveBeenCalled();
  });

  it('un vendedor consulta todas las órdenes de su tenant', async () => {
    const ordenFindMany = jest.fn().mockResolvedValue([]);
    const service = servicioVacio() as unknown as {
      prisma: unknown;
      reconciliarTramosVencidos: () => Promise<void>;
      backfillPasosTablero: () => Promise<void>;
      tecnologiaPorMaquinaDeItems: () => Promise<Map<string, string | null>>;
      tablero: OrdenesTrabajoService['tablero'];
    };
    service.prisma = {
      ordenTrabajo: { findMany: ordenFindMany },
    };
    service.reconciliarTramosVencidos = jest.fn().mockResolvedValue(undefined);
    service.backfillPasosTablero = jest.fn().mockResolvedValue(undefined);
    service.tecnologiaPorMaquinaDeItems = jest
      .fn()
      .mockResolvedValue(new Map());

    await service.tablero(
      authCon(['comercial.ver', 'comercial.gestionar', 'produccion.ver']),
    );

    expect(ordenFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // El matcher de Jest es dinámico; los criterios productivos son Prisma.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          tenantId: 'tenant-1',
        }),
      }),
    );
  });

  it('un ejecutor ve todos los pasos y el cliente, sin que leer implique ejecutar', async () => {
    const paso = (id: string, mesaUsuarioId: string | null) => ({
      id,
      indice: id === 'propio' ? 0 : 1,
      rutaPasoId: null,
      familiaCodigo: 'impresion_por_hoja',
      categoriaFamilia: 'impresion',
      nombre: id,
      centroCostoId: null,
      centroCostoNombre: null,
      maquinaId: null,
      duracionEstimadaMin: 10,
      estado: 'pendiente',
      motivoBloqueo: null,
      tipoEjecucion: 'interno',
      proveedorNombre: null,
      plazoProveedorDias: null,
      estadoCompra: null,
      iniciadoEl: null,
      completadoEl: null,
      modoRegistro: 'cronometro',
      tiempoRealMin: null,
      tiempoFuente: null,
      iniciadoPorNombre: null,
      completadoPorNombre: null,
      mesaUsuarioId,
      mesaUsuario: mesaUsuarioId
        ? { nombreCompleto: 'Operario', email: 'operario@ejemplo.com' }
        : null,
      tramos: [],
    });
    const orden = {
      id: 'orden-1',
      numero: 'OT-001',
      estado: 'produccion',
      fechaEntrega: new Date('2026-08-20T00:00:00.000Z'),
      createdAt: new Date(),
      cliente: { nombre: 'CLIENTE SECRETO' },
      vendedor: { nombreCompleto: 'VENDEDOR SECRETO' },
      items: [
        {
          id: 'item-1',
          ordenIndice: 0,
          codigo: 'ITEM',
          nombre: 'Producto',
          cantidad: 1,
          cantidadUnidad: 'u',
          specsJson: [{ etiqueta: 'Dato', valor: 'SPEC SECRETO' }],
          cotizacionItem: null,
          _count: { archivos: 0 },
          pasos: [paso('propio', 'usuario-1'), paso('ajeno', 'usuario-2')],
        },
      ],
    };
    const service = servicioVacio() as unknown as {
      prisma: unknown;
      reconciliarTramosVencidos: () => Promise<void>;
      backfillPasosTablero: () => Promise<void>;
      tecnologiaPorMaquinaDeItems: () => Promise<Map<string, string | null>>;
      tablero: OrdenesTrabajoService['tablero'];
    };
    service.prisma = {
      empleado: {
        findFirst: jest.fn().mockResolvedValue({ estaciones: [] }),
      },
      ordenTrabajo: { findMany: jest.fn().mockResolvedValue([orden]) },
    };
    service.reconciliarTramosVencidos = jest.fn().mockResolvedValue(undefined);
    service.backfillPasosTablero = jest.fn().mockResolvedValue(undefined);
    service.tecnologiaPorMaquinaDeItems = jest
      .fn()
      .mockResolvedValue(new Map());

    const respuesta = await service.tablero(
      authCon(['panel.ver', 'produccion.ver', 'produccion.ejecutar']),
    );
    const serializado = JSON.stringify(respuesta);

    expect(respuesta.alcance).toBe('completo');
    expect(respuesta.items).toHaveLength(1);
    expect(respuesta.items[0]?.pasos.map((p) => p.id)).toEqual(['propio', 'ajeno']);
    expect(serializado).toContain('CLIENTE SECRETO');
    expect(respuesta.estacionIdsEjecutables).toEqual([]);
  });
});

describe('concurrencia del Tablero de producción', () => {
  it('permite reclamar sólo una estación habilitada para el empleado vinculado', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = servicioVacio() as unknown as {
      prisma: unknown;
      tableroItemActualizado: () => Promise<{ id: string }>;
      mesaPaso: OrdenesTrabajoService['mesaPaso'];
    };
    service.prisma = {
      ordenTrabajoItemPaso: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'paso-1',
          itemId: 'item-1',
          estado: 'pendiente',
          mesaUsuarioId: null,
          familiaCodigo: 'impresion_por_hoja',
          maquinaId: null,
        }),
        updateMany,
      },
      empleado: { findFirst: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
      estacion: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'est-1',
            activo: true,
            reglas: [{ tipo: 'familia', valor: 'impresion_por_hoja' }],
            maquinas: [],
            empleados: [{ empleadoId: 'emp-1' }],
          },
        ]),
      },
    };
    service.tableroItemActualizado = jest.fn().mockResolvedValue({ id: 'item-1' });

    await expect(
      service.mesaPaso(
        authCon(['produccion.ver', 'produccion.ejecutar']),
        'paso-1',
        true,
      ),
    ).resolves.toEqual({ id: 'item-1' });
    expect(updateMany).toHaveBeenCalled();
  });

  it('rechaza reclamar una estación no habilitada', async () => {
    const updateMany = jest.fn();
    const service = servicioVacio() as unknown as {
      prisma: unknown;
      mesaPaso: OrdenesTrabajoService['mesaPaso'];
    };
    service.prisma = {
      ordenTrabajoItemPaso: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'paso-1',
          itemId: 'item-1',
          estado: 'pendiente',
          mesaUsuarioId: null,
          familiaCodigo: 'impresion_por_hoja',
          maquinaId: null,
        }),
        updateMany,
      },
      empleado: { findFirst: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
      estacion: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'est-1',
            activo: true,
            reglas: [{ tipo: 'familia', valor: 'impresion_por_hoja' }],
            maquinas: [],
            empleados: [{ empleadoId: 'emp-2' }],
          },
        ]),
      },
    };

    await expect(
      service.mesaPaso(
        authCon(['produccion.ver', 'produccion.ejecutar']),
        'paso-1',
        true,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('no permite pisar el reclamo de otra persona', async () => {
    const updateMany = jest.fn();
    const service = servicioVacio() as unknown as {
      prisma: unknown;
      mesaPaso: OrdenesTrabajoService['mesaPaso'];
    };
    service.prisma = {
      ordenTrabajoItemPaso: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'paso-1',
          itemId: 'item-1',
          estado: 'pendiente',
          mesaUsuarioId: 'usuario-2',
        }),
        updateMany,
      },
    };

    await expect(
      service.mesaPaso(
        authCon(['produccion.ver', 'produccion.supervisar']),
        'paso-1',
        true,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('resuelve con conflicto si otra persona gana el reclamo concurrente', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const service = servicioVacio() as unknown as {
      prisma: unknown;
      mesaPaso: OrdenesTrabajoService['mesaPaso'];
    };
    service.prisma = {
      ordenTrabajoItemPaso: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'paso-1',
          itemId: 'item-1',
          estado: 'pendiente',
          mesaUsuarioId: null,
        }),
        updateMany,
      },
    };

    await expect(
      service.mesaPaso(
        authCon(['produccion.ver', 'produccion.supervisar']),
        'paso-1',
        true,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'paso-1',
        tenantId: 'tenant-1',
        mesaUsuarioId: null,
      },
      data: { mesaUsuarioId: 'usuario-1' },
    });
  });

  it('rechaza una acción del operario sobre un paso fuera de su mesa', async () => {
    const findMany = jest.fn();
    const service = servicioVacio() as unknown as {
      prisma: unknown;
      reconciliarTramosVencidos: () => Promise<void>;
      accionPaso: OrdenesTrabajoService['accionPaso'];
    };
    service.reconciliarTramosVencidos = jest.fn().mockResolvedValue(undefined);
    service.prisma = {
      ordenTrabajoItemPaso: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'paso-1',
          mesaUsuarioId: 'usuario-2',
          tramos: [],
          orden: { estado: 'produccion', progresoPct: 0 },
          item: { nombre: 'Producto', ordenIndice: 0 },
        }),
        findMany,
      },
      empleado: { findFirst: jest.fn().mockResolvedValue(null) },
      estacion: { findMany: jest.fn().mockResolvedValue([]) },
    };

    await expect(
      service.accionPaso(
        authCon(['produccion.ver', 'produccion.ejecutar']),
        'orden-1',
        'item-1',
        'paso-1',
        { accion: 'iniciar' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('usa compare-and-set y no abre un segundo tramo si el paso cambió', async () => {
    const tramoCreate = jest.fn();
    const pasoUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    const ordenUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      ordenTrabajo: { updateMany: ordenUpdateMany },
      ordenTrabajoItemPaso: { updateMany: pasoUpdateMany },
      ordenTrabajoPasoTramo: { create: tramoCreate },
    };
    const service = servicioVacio() as unknown as {
      prisma: unknown;
      reconciliarTramosVencidos: () => Promise<void>;
      accionPaso: OrdenesTrabajoService['accionPaso'];
    };
    service.reconciliarTramosVencidos = jest.fn().mockResolvedValue(undefined);
    service.prisma = {
      ordenTrabajoItemPaso: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'paso-1',
          ordenId: 'orden-1',
          itemId: 'item-1',
          estado: 'pendiente',
          nombre: 'Impresión',
          modoRegistro: 'cronometro',
          mesaUsuarioId: 'usuario-1',
          iniciadoEl: null,
          iniciadoPorId: null,
          duracionEstimadaMin: 10,
          tramos: [],
          orden: { estado: 'produccion', progresoPct: 0 },
          item: { nombre: 'Producto', ordenIndice: 0 },
        }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ indice: 0, estado: 'pendiente' }]),
      },
      empleado: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(
        (callback: (cliente: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };

    await expect(
      service.accionPaso(
        authCon(['produccion.ver', 'produccion.supervisar']),
        'orden-1',
        'item-1',
        'paso-1',
        { accion: 'iniciar' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ordenUpdateMany).toHaveBeenCalled();
    expect(pasoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // El matcher de Jest es dinámico; el valor productivo queda tipado.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({ estado: 'pendiente' }),
      }),
    );
    expect(tramoCreate).not.toHaveBeenCalled();
  });
});
